CREATE TYPE "public"."agreement_type" AS ENUM('service_agreement', 'partnership_agreement', 'agent_agreement', 'ca_engagement_letter', 'lender_agreement', 'client_agreement', 'nda', 'mou', 'amendment', 'addendum', 'renewal', 'termination', 'compliance_declaration', 'kyc_document', 'regulatory_filing', 'other');--> statement-breakpoint
CREATE TYPE "public"."bank_connector_type" AS ENUM('api', 'sftp', 'portal', 'email', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."change_operation" AS ENUM('insert', 'delete', 'modify', 'comment');--> statement-breakpoint
CREATE TYPE "public"."commission_plan_status" AS ENUM('draft', 'active', 'frozen', 'archived');--> statement-breakpoint
CREATE TYPE "public"."document_entity_type" AS ENUM('vendor', 'partner', 'agent', 'ca', 'lender', 'client', 'regulator', 'internal');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('draft', 'negotiation', 'review', 'approved', 'signed', 'legacy', 'expired', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."dsa_loan_status" AS ENUM('draft', 'submitted', 'eligibility_check', 'routed', 'pending_with_banks', 'in_review', 'approved', 'rejected', 'disbursed', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."fund_status" AS ENUM('active', 'soft_close', 'hard_close', 'existing_only', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."investment_inquiry_status" AS ENUM('new', 'contacted', 'qualified', 'negotiating', 'closed_won', 'closed_lost');--> statement-breakpoint
CREATE TYPE "public"."investment_inquiry_type" AS ENUM('aif', 'pms', 'mld');--> statement-breakpoint
CREATE TYPE "public"."meeting_booking_status" AS ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."mld_payoff_type" AS ENUM('digital', 'barrier', 'sharkfin', 'range', 'participation', 'autocall', 'snowball');--> statement-breakpoint
CREATE TYPE "public"."mld_status" AS ENUM('active', 'closed', 'matured', 'called_back');--> statement-breakpoint
CREATE TYPE "public"."nav_frequency" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY');--> statement-breakpoint
CREATE TYPE "public"."passthrough_rule" AS ENUM('stop', 'roll_up');--> statement-breakpoint
CREATE TYPE "public"."payout_mode" AS ENUM('upfront', 'trail', 'revenue_share', 'performance');--> statement-breakpoint
CREATE TYPE "public"."pick_category" AS ENUM('listed_stocks', 'mutual_funds', 'bonds', 'unlisted', 'global_stocks', 'etfs', 'reits_invits', 'fixed_deposits', 'sgb');--> statement-breakpoint
CREATE TYPE "public"."pick_status" AS ENUM('live', 'target_hit', 'stoploss_hit', 'expired');--> statement-breakpoint
CREATE TYPE "public"."portfolio_entry_status" AS ENUM('pending', 'approved', 'rejected', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."routing_strategy" AS ENUM('parallel', 'waterfall', 'priority_first');--> statement-breakpoint
CREATE TYPE "public"."staff_change_type" AS ENUM('resignation', 'termination', 'transfer', 'promotion', 'leave');--> statement-breakpoint
CREATE TABLE "a2_forms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_number" varchar(50) NOT NULL,
	"transaction_id" varchar,
	"applicant_name" varchar(200) NOT NULL,
	"applicant_pan" varchar(10) NOT NULL,
	"applicant_address" text,
	"applicant_email" varchar(255),
	"applicant_phone" varchar(15),
	"purpose_code" varchar(10) NOT NULL,
	"purpose_description" text,
	"amount_inr" numeric NOT NULL,
	"amount_fcy" numeric NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"exchange_rate" numeric NOT NULL,
	"beneficiary_name" varchar(200) NOT NULL,
	"beneficiary_address" text,
	"beneficiary_country" varchar(3) NOT NULL,
	"beneficiary_bank_name" varchar(200),
	"beneficiary_bank_address" text,
	"beneficiary_account_number" varchar(50),
	"swift_code" varchar(11),
	"iban" varchar(34),
	"ad_bank_name" varchar(200),
	"ad_branch_name" varchar(200),
	"ad_code" varchar(20),
	"ad_branch_address" text,
	"declarations" jsonb DEFAULT '{}'::jsonb,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"acknowledgement_number" varchar(50),
	"document_hash" varchar(64),
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp,
	"acknowledged_at" timestamp,
	"retain_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "a2_forms_form_number_unique" UNIQUE("form_number")
);
--> statement-breakpoint
CREATE TABLE "aa_consent_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"pan_number" varchar NOT NULL,
	"aa_provider" varchar DEFAULT 'finvu' NOT NULL,
	"fiu_entity_id" varchar,
	"consent_handle_id" varchar,
	"consent_id" varchar,
	"consent_artefact_id" varchar,
	"redirect_url" text,
	"callback_url" text,
	"asset_types" jsonb DEFAULT '["MF", "DEMAT", "PPF", "NPS", "LOANS"]'::jsonb,
	"validity_days" integer DEFAULT 90,
	"sync_frequency_days" integer DEFAULT 30,
	"fetch_type" varchar DEFAULT 'PERIODIC',
	"status" varchar DEFAULT 'initiated' NOT NULL,
	"initiated_at" timestamp DEFAULT now(),
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"expires_at" timestamp,
	"last_data_fetch_at" timestamp,
	"error_code" varchar,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "aa_consent_sessions_consent_handle_id_unique" UNIQUE("consent_handle_id")
);
--> statement-breakpoint
CREATE TABLE "aa_data_fetch_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consent_session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"fiu_name" varchar NOT NULL,
	"data_type" varchar NOT NULL,
	"status" varchar DEFAULT 'initiated' NOT NULL,
	"used_fallback" boolean DEFAULT false,
	"fallback_source" varchar,
	"fallback_reason" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"duration_ms" integer,
	"records_fetched" integer DEFAULT 0,
	"total_value" numeric(15, 2),
	"error_code" varchar,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "aa_raw_payloads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consent_session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"fetch_session_id" varchar NOT NULL,
	"fiu_name" varchar,
	"data_type" varchar NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"is_decrypted" boolean DEFAULT false,
	"decrypted_at" timestamp,
	"is_processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"records_extracted" integer DEFAULT 0,
	"processing_errors" jsonb,
	"data_quality_score" integer,
	"missing_fields" jsonb,
	"retention_days" integer DEFAULT 180,
	"expires_at" timestamp,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"fetched_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ab_testing_experiment_state" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" varchar NOT NULL,
	"experiment_name" varchar NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"kill_switch_activated" boolean DEFAULT false NOT NULL,
	"kill_switch_activated_at" timestamp,
	"kill_switch_activated_by" varchar,
	"kill_switch_reason" text,
	"control_group" varchar DEFAULT 'balanced',
	"treatment_group" varchar DEFAULT 'growth',
	"traffic_allocation" integer DEFAULT 50,
	"safety_thresholds" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ab_testing_experiment_state_experiment_id_unique" UNIQUE("experiment_id")
);
--> statement-breakpoint
CREATE TABLE "ab_testing_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"assigned_group" varchar NOT NULL,
	"assigned_mode" varchar NOT NULL,
	"recommendations_viewed" integer DEFAULT 0,
	"recommendations_accepted" integer DEFAULT 0,
	"total_allocation_amount" numeric(18, 2) DEFAULT '0',
	"time_to_decision_ms" integer,
	"session_started_at" timestamp DEFAULT now(),
	"last_activity_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ab_tests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"test_key" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"metric" varchar(100) NOT NULL,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sample_size" integer DEFAULT 0,
	"winner" varchar(100),
	"target_audience" text[] DEFAULT ARRAY[]::text[],
	"start_date" timestamp,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar,
	CONSTRAINT "ab_tests_test_key_unique" UNIQUE("test_key")
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
CREATE TABLE "active_investment_limit_overrides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"product_category" varchar NOT NULL,
	"product_sub_category" varchar,
	"isin" varchar,
	"override_type" varchar NOT NULL,
	"override_value" jsonb NOT NULL,
	"valid_from" timestamp NOT NULL,
	"valid_until" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ad_certificates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certificate_number" varchar(50) NOT NULL,
	"transaction_id" varchar,
	"ad_bank_name" varchar(200) NOT NULL,
	"ad_bank_branch" varchar(200),
	"ad_code" varchar(20) NOT NULL,
	"applicant_name" varchar(200) NOT NULL,
	"applicant_pan" varchar(10) NOT NULL,
	"purpose_code" varchar(10) NOT NULL,
	"remittance_amount_usd" numeric NOT NULL,
	"remittance_amount_inr" numeric NOT NULL,
	"exchange_rate" numeric NOT NULL,
	"beneficiary_details" text,
	"lrs_utilization" numeric,
	"tcs_deducted" numeric DEFAULT '0',
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"document_hash" varchar(64),
	"retain_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ad_certificates_certificate_number_unique" UNIQUE("certificate_number")
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
CREATE TABLE "advisory_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"proposal_id" varchar,
	"session_purpose" varchar NOT NULL,
	"session_type" varchar DEFAULT 'advisory',
	"workflow_state" varchar DEFAULT 'purpose_selection' NOT NULL,
	"workflow_state_updated_at" timestamp DEFAULT now(),
	"suitability_check_passed" boolean DEFAULT false,
	"suitability_check_id" varchar,
	"optimization_completed" boolean DEFAULT false,
	"optimization_version" varchar,
	"agent_arn_code" varchar,
	"agent_euin_number" varchar,
	"agent_declaration_acknowledged" boolean DEFAULT false,
	"agent_declaration_timestamp" timestamp,
	"client_viewed_at" timestamp,
	"client_action_status" varchar,
	"client_action_timestamp" timestamp,
	"client_action_note" text,
	"investment_amount" numeric(15, 2),
	"investable_surplus_amount" numeric(15, 2),
	"is_active" boolean DEFAULT true,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "advisory_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"plan_name" varchar NOT NULL,
	"plan_type" varchar NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"subscription_fee" numeric(15, 2),
	"fee_frequency" varchar DEFAULT 'annual',
	"last_payment_date" date,
	"next_payment_date" date,
	"direct_funds_access" boolean DEFAULT true,
	"max_direct_fund_investment" numeric(15, 2),
	"included_categories" text[],
	"enrolled_by" varchar,
	"enrolled_by_role" varchar,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"cancelled_at" timestamp,
	"cancellation_reason" text
);
--> statement-breakpoint
CREATE TABLE "agent_appointments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"client_id" varchar,
	"title" varchar NOT NULL,
	"description" text,
	"meeting_type" varchar NOT NULL,
	"date" date NOT NULL,
	"start_time" varchar NOT NULL,
	"end_time" varchar NOT NULL,
	"duration" integer NOT NULL,
	"location" varchar,
	"location_details" text,
	"reminder" varchar DEFAULT '30min',
	"reminder_sent" boolean DEFAULT false,
	"status" varchar DEFAULT 'scheduled',
	"notes" text,
	"agenda" text,
	"client_name" varchar,
	"client_email" varchar,
	"client_phone" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_certifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"certification_type" varchar NOT NULL,
	"certification_name" varchar NOT NULL,
	"training_completed_at" timestamp,
	"training_modules_completed" integer DEFAULT 0,
	"total_training_modules" integer DEFAULT 0,
	"quiz_attempts" integer DEFAULT 0,
	"quiz_passed_at" timestamp,
	"quiz_score" integer,
	"passing_score" integer DEFAULT 80,
	"is_certified" boolean DEFAULT false,
	"certified_at" timestamp,
	"expires_at" timestamp,
	"is_revoked" boolean DEFAULT false,
	"revoked_at" timestamp,
	"revocation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_client_mapping_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"agent_name" varchar,
	"client_id" varchar,
	"client_pan" varchar,
	"client_email" varchar,
	"client_mobile" varchar,
	"client_name" varchar,
	"current_agent_id" varchar,
	"current_agent_name" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"request_reason" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"agent_notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "agent_compliance_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"client_id" varchar,
	"session_id" varchar,
	"proposal_id" varchar,
	"agent_arn_code" varchar,
	"agent_euin_number" varchar,
	"agent_name" varchar,
	"action_category" varchar NOT NULL,
	"action_type" varchar NOT NULL,
	"action_description" text NOT NULL,
	"previous_state" jsonb,
	"new_state" jsonb,
	"changed_fields" jsonb,
	"suitability_check_id" varchar,
	"suitability_passed" boolean,
	"optimizer_version" varchar,
	"rebalancer_version" varchar,
	"explainability_version" varchar,
	"client_consent_obtained" boolean,
	"client_consent_timestamp" timestamp,
	"client_consent_method" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"device_fingerprint" varchar,
	"is_sebi_reportable" boolean DEFAULT false,
	"regulatory_report_id" varchar,
	"retention_end_date" timestamp,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"archive_location" varchar,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_compliance_doc_repository" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_type" varchar NOT NULL,
	"document_name" varchar NOT NULL,
	"document_category" varchar NOT NULL,
	"version" varchar NOT NULL,
	"effective_date" date NOT NULL,
	"expiry_date" date,
	"is_active" boolean DEFAULT true,
	"content_html" text,
	"content_pdf" text,
	"summary" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "agent_itr_activity_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"activity_type" varchar NOT NULL,
	"previous_value" text,
	"new_value" text,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_itr_cases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"ca_id" varchar,
	"assessment_year" varchar NOT NULL,
	"financial_year" varchar NOT NULL,
	"itr_form_type" varchar,
	"filing_type" varchar DEFAULT 'original',
	"status" varchar DEFAULT 'initiated' NOT NULL,
	"sub_status" varchar,
	"salary_income" numeric(15, 2) DEFAULT '0',
	"interest_income" numeric(15, 2) DEFAULT '0',
	"dividend_income" numeric(15, 2) DEFAULT '0',
	"capital_gains_stcg" numeric(15, 2) DEFAULT '0',
	"capital_gains_ltcg" numeric(15, 2) DEFAULT '0',
	"business_income" numeric(15, 2) DEFAULT '0',
	"other_income" numeric(15, 2) DEFAULT '0',
	"total_gross_income" numeric(15, 2) DEFAULT '0',
	"section_80c" numeric(15, 2) DEFAULT '0',
	"section_80d" numeric(15, 2) DEFAULT '0',
	"other_deductions" numeric(15, 2) DEFAULT '0',
	"total_deductions" numeric(15, 2) DEFAULT '0',
	"taxable_income" numeric(15, 2) DEFAULT '0',
	"tax_regime" varchar DEFAULT 'new',
	"tax_payable" numeric(15, 2) DEFAULT '0',
	"tds_paid" numeric(15, 2) DEFAULT '0',
	"advance_tax_paid" numeric(15, 2) DEFAULT '0',
	"self_assessment_tax" numeric(15, 2) DEFAULT '0',
	"refund_or_due" numeric(15, 2) DEFAULT '0',
	"documents_required" jsonb DEFAULT '[]'::jsonb,
	"documents_received" jsonb DEFAULT '[]'::jsonb,
	"documents_missing" jsonb DEFAULT '[]'::jsonb,
	"itr_acknowledgement_no" varchar,
	"itr_filed_date" timestamp,
	"itr_verification_status" varchar,
	"itr_verification_method" varchar,
	"itr_verified_date" timestamp,
	"service_fee" numeric(10, 2) DEFAULT '0',
	"ca_fee" numeric(10, 2) DEFAULT '0',
	"total_fee" numeric(10, 2) DEFAULT '0',
	"fee_status" varchar DEFAULT 'pending',
	"client_queries" jsonb DEFAULT '[]'::jsonb,
	"internal_notes" jsonb DEFAULT '[]'::jsonb,
	"priority" varchar DEFAULT 'normal',
	"due_date" timestamp,
	"sla_breached" boolean DEFAULT false,
	"source_product" varchar,
	"referral_code" varchar,
	"zoho_synced_at" timestamp,
	"zoho_invoice_id" varchar,
	"zoho_bill_id" varchar,
	"zoho_sync_status" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_itr_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"document_type" varchar NOT NULL,
	"document_name" varchar NOT NULL,
	"document_url" text,
	"file_size" integer,
	"mime_type" varchar,
	"status" varchar DEFAULT 'uploaded',
	"review_notes" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"parsed_data" jsonb,
	"parsing_status" varchar,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar,
	"name" varchar NOT NULL,
	"email" varchar,
	"phone" varchar,
	"stage" varchar DEFAULT 'new' NOT NULL,
	"source" varchar DEFAULT 'manual',
	"potential_value" numeric DEFAULT '0',
	"score" integer DEFAULT 50,
	"notes" text,
	"last_contact_at" timestamp,
	"next_follow_up_at" timestamp,
	"tags" text[],
	"converted_to_user_id" varchar,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_override_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"agent_name" varchar,
	"client_id" varchar NOT NULL,
	"basket_id" varchar,
	"override_type" varchar NOT NULL,
	"previous_value" text,
	"new_value" text,
	"reason" text NOT NULL,
	"original_mode" varchar NOT NULL,
	"overridden_mode" varchar,
	"scoring_snapshot" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"compliance_flag" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "agent_performance_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"agent_name" varchar,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"period_type" varchar NOT NULL,
	"total_recommendations" integer DEFAULT 0,
	"accepted_recommendations" integer DEFAULT 0,
	"rejected_recommendations" integer DEFAULT 0,
	"pending_recommendations" integer DEFAULT 0,
	"conservative_mode_count" integer DEFAULT 0,
	"balanced_mode_count" integer DEFAULT 0,
	"growth_mode_count" integer DEFAULT 0,
	"total_overrides" integer DEFAULT 0,
	"mode_downgrade_overrides" integer DEFAULT 0,
	"asset_class_lock_overrides" integer DEFAULT 0,
	"allocation_cap_overrides" integer DEFAULT 0,
	"compliance_violations" integer DEFAULT 0,
	"client_complaints" integer DEFAULT 0,
	"total_aum_managed" numeric(18, 2) DEFAULT '0',
	"new_aum_brought" numeric(18, 2) DEFAULT '0',
	"total_commission_earned" numeric(18, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_performance_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"score_period" varchar NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"recommendation_adoption_score" integer DEFAULT 0,
	"risk_adjusted_performance_score" integer DEFAULT 0,
	"compliance_discipline_score" integer DEFAULT 0,
	"final_score" integer DEFAULT 0,
	"score_breakdown" jsonb,
	"agent_rank" integer,
	"total_agents" integer,
	"calculated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_portfolio_outcomes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"proposal_id" varchar,
	"portfolio_irr" numeric(8, 4),
	"benchmark_return" numeric(8, 4),
	"excess_return" numeric(8, 4),
	"upside_capture_ratio" numeric(8, 4),
	"downside_capture_ratio" numeric(8, 4),
	"max_drawdown" numeric(8, 4),
	"portfolio_volatility" numeric(8, 4),
	"client_risk_profile" varchar,
	"actual_risk_level" varchar,
	"within_risk_band" boolean DEFAULT true,
	"benchmark_used" varchar,
	"evaluation_period_months" integer,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"data_as_of_date" date
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
	"marketing_name" varchar,
	"marketing_designation" varchar,
	"marketing_email" varchar,
	"marketing_phone" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "agents_email_unique" UNIQUE("email"),
	CONSTRAINT "agents_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE "ai_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar,
	"proposal_item_id" varchar,
	"diagnostics_id" varchar,
	"actor_id" varchar,
	"actor_role" varchar NOT NULL,
	"action" varchar NOT NULL,
	"action_category" varchar NOT NULL,
	"previous_state" jsonb,
	"new_state" jsonb,
	"change_details" jsonb,
	"ai_engine_version" varchar,
	"ai_input_snapshot" jsonb,
	"ai_output_snapshot" jsonb,
	"ai_model_used" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"session_id" varchar,
	"is_regulator_auditable" boolean DEFAULT true,
	"compliance_note" text,
	"timestamp" timestamp DEFAULT now()
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
CREATE TABLE "ai_portfolio_analysis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"portfolio_id" varchar NOT NULL,
	"agent_id" varchar,
	"analysis_date" timestamp DEFAULT now() NOT NULL,
	"total_value" numeric(15, 2),
	"total_invested" numeric(15, 2),
	"total_gain_loss" numeric(15, 2),
	"total_gain_loss_percent" numeric(8, 4),
	"cagr_1y" numeric(8, 4),
	"cagr_3y" numeric(8, 4),
	"cagr_5y" numeric(8, 4),
	"xirr" numeric(8, 4),
	"absolute_return" numeric(8, 4),
	"portfolio_beta" numeric(8, 4),
	"sharpe_ratio" numeric(8, 4),
	"standard_deviation" numeric(8, 4),
	"max_drawdown" numeric(8, 4),
	"risk_score" integer,
	"top_holding_weight" numeric(8, 4),
	"top_5_holdings_weight" numeric(8, 4),
	"sector_concentration" jsonb,
	"equity_allocation" numeric(8, 4),
	"debt_allocation" numeric(8, 4),
	"gold_allocation" numeric(8, 4),
	"cash_allocation" numeric(8, 4),
	"alternative_allocation" numeric(8, 4),
	"ultra_short_term_allocation" numeric(8, 4),
	"short_term_allocation" numeric(8, 4),
	"medium_term_allocation" numeric(8, 4),
	"long_term_allocation" numeric(8, 4),
	"client_risk_profile" varchar,
	"portfolio_risk_alignment" varchar,
	"risk_mismatch_details" text,
	"overall_health_score" integer,
	"ai_summary" text,
	"key_strengths" jsonb,
	"key_weaknesses" jsonb,
	"recommendations" jsonb,
	"sector_analysis" jsonb,
	"holdings_analysis" jsonb,
	"benchmark_comparison" jsonb,
	"status" varchar DEFAULT 'completed',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_profit_picks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"agent_id" varchar,
	"stock_name" varchar NOT NULL,
	"symbol" varchar NOT NULL,
	"isin" varchar,
	"exchange" varchar DEFAULT 'NSE',
	"current_price" numeric(15, 2) NOT NULL,
	"target_price" numeric(15, 2) NOT NULL,
	"stop_loss_price" numeric(15, 2),
	"upside_percent" numeric(8, 2) NOT NULL,
	"downside_percent" numeric(8, 2),
	"profit_score" integer NOT NULL,
	"confidence_level" varchar DEFAULT 'medium',
	"signal_type" varchar DEFAULT 'buy' NOT NULL,
	"signal_strength" varchar DEFAULT 'moderate',
	"time_horizon" varchar NOT NULL,
	"time_horizon_days" integer,
	"risk_level" varchar NOT NULL,
	"risk_score" integer,
	"volatility_rating" varchar,
	"sector" varchar,
	"industry" varchar,
	"sector_trend" varchar,
	"sector_rank" integer,
	"pe_ratio" numeric(10, 2),
	"pb_ratio" numeric(10, 2),
	"eps" numeric(15, 2),
	"roe" numeric(8, 2),
	"debt_to_equity" numeric(10, 2),
	"market_cap" numeric(20, 0),
	"dividend_yield" numeric(8, 2),
	"rsi_value" numeric(8, 2),
	"macd_signal" varchar,
	"moving_average_50" numeric(15, 2),
	"moving_average_200" numeric(15, 2),
	"support_level" numeric(15, 2),
	"resistance_level" numeric(15, 2),
	"ai_reason" text NOT NULL,
	"ai_analysis" text,
	"key_factors" jsonb,
	"risk_factors" jsonb,
	"agent_approved" boolean DEFAULT false,
	"agent_modified" boolean DEFAULT false,
	"agent_notes" text,
	"agent_override_reason" text,
	"modified_target_price" numeric(15, 2),
	"modified_quantity" integer,
	"added_to_proposal" boolean DEFAULT false,
	"proposal_id" varchar,
	"proposed_quantity" integer,
	"proposed_amount" numeric(15, 2),
	"status" varchar DEFAULT 'active',
	"expires_at" timestamp,
	"executed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_proposal_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"recommendation_type" varchar NOT NULL,
	"asset_class" varchar NOT NULL,
	"product_id" varchar,
	"isin" varchar,
	"scheme_name" varchar NOT NULL,
	"amc_name" varchar,
	"switch_from_product_id" varchar,
	"switch_from_isin" varchar,
	"switch_from_scheme_name" varchar,
	"amount" numeric(20, 2),
	"units" numeric(15, 4),
	"current_value" numeric(20, 2),
	"rationale" text NOT NULL,
	"problem_identified" text,
	"risk_involved" text,
	"portfolio_impact_summary" text,
	"risk_impact_percent" varchar,
	"product_disclaimer" text,
	"priority" integer DEFAULT 1,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"agent_modified" boolean DEFAULT false,
	"original_amount" numeric(20, 2),
	"original_rationale" text,
	"agent_modification_reason" text,
	"client_decision" varchar,
	"client_decision_at" timestamp,
	"client_rejection_reason" text,
	"executed_at" timestamp,
	"cart_item_id" varchar,
	"order_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_proposals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"agent_id" varchar,
	"diagnostics_id" varchar,
	"proposal_number" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"valid_until" timestamp,
	"before_allocation" jsonb,
	"after_allocation" jsonb,
	"risk_score_before" numeric(5, 2),
	"risk_score_after" numeric(5, 2),
	"expected_risk_impact" varchar,
	"total_investment_amount" numeric(20, 2),
	"total_redemption_amount" numeric(20, 2),
	"net_cash_flow" numeric(20, 2),
	"ai_engine_version" varchar DEFAULT '1.0.0',
	"ai_model_used" varchar,
	"ai_generated_at" timestamp,
	"sebi_disclaimer" text DEFAULT 'This investment proposal is generated using an AI-assisted analytical system based on information provided by the client and available market data. The recommendations are not investment advice, do not assure returns, and are subject to market risks. Final investment decisions shall be taken by the client after independent evaluation.' NOT NULL,
	"disclaimer_acknowledged" boolean DEFAULT false,
	"disclaimer_acknowledged_at" timestamp,
	"agent_notes" text,
	"agent_modified_at" timestamp,
	"client_decision" varchar,
	"client_decision_at" timestamp,
	"client_notes" text,
	"executed_at" timestamp,
	"cart_reference_ids" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ai_proposals_proposal_number_unique" UNIQUE("proposal_number")
);
--> statement-breakpoint
CREATE TABLE "ai_rationale_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"input_hash" varchar(64) NOT NULL,
	"rationale_type" varchar(50) NOT NULL,
	"product_type" varchar(50),
	"product_id" varchar(100),
	"user_id" varchar,
	"risk_profile" varchar(50),
	"investment_horizon" varchar(50),
	"input_snapshot" jsonb NOT NULL,
	"rationale" text NOT NULL,
	"summary" text,
	"key_points" jsonb,
	"risk_warnings" jsonb,
	"confidence_score" numeric(5, 4),
	"model_used" varchar(50),
	"tokens_used" integer,
	"generation_time_ms" integer,
	"hit_count" integer DEFAULT 0,
	"last_hit_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_invalidated" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "ai_recommendation_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(50) NOT NULL,
	"asset_name" varchar(255) NOT NULL,
	"asset_type" varchar(50) NOT NULL,
	"sector" varchar(100),
	"recommendation_type" varchar(20) NOT NULL,
	"entry_price" numeric(12, 2) NOT NULL,
	"target_price" numeric(12, 2) NOT NULL,
	"stop_loss" numeric(12, 2),
	"confidence_score" numeric(5, 2) NOT NULL,
	"timeframe_in_days" integer NOT NULL,
	"expiry_date" timestamp NOT NULL,
	"ai_model" varchar(100) DEFAULT 'gemini-1.5-flash',
	"reasoning" text,
	"status" varchar(20) DEFAULT 'pending',
	"current_price" numeric(12, 2),
	"highest_price" numeric(12, 2),
	"lowest_price" numeric(12, 2),
	"actual_return" numeric(8, 2),
	"resolved_at" timestamp,
	"resolution_note" text,
	"user_id" varchar,
	"agent_id" varchar,
	"source" varchar(50) DEFAULT 'stock_ai',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_talking_points" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"agent_id" varchar,
	"analysis_id" varchar,
	"profit_pick_id" varchar,
	"point_type" varchar NOT NULL,
	"category" varchar,
	"title" varchar NOT NULL,
	"agent_script" text NOT NULL,
	"client_facing_version" text,
	"supporting_data" jsonb,
	"visual_aid" varchar,
	"tone" varchar DEFAULT 'professional',
	"emphasis" varchar,
	"sequence_order" integer DEFAULT 0,
	"is_required" boolean DEFAULT false,
	"agent_used" boolean DEFAULT false,
	"agent_used_at" timestamp,
	"agent_modified" boolean DEFAULT false,
	"agent_version" text,
	"status" varchar DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "aif_master" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"registration_no" text,
	"category" text,
	"subcategory" text,
	"manager_id" varchar,
	"fund_house_name" text,
	"sponsor" text,
	"style" text,
	"min_investment" numeric(15, 2) DEFAULT '10000000',
	"lock_in" text,
	"liquidity_frequency" text,
	"benchmark" text,
	"fund_status" text DEFAULT 'active',
	"is_published" boolean DEFAULT false,
	"nav_frequency" text DEFAULT 'MONTHLY',
	"latest_nav" numeric(15, 4),
	"last_nav_date" date,
	"aum" numeric(20, 2),
	"return_1m" numeric(8, 4),
	"return_3m" numeric(8, 4),
	"return_6m" numeric(8, 4),
	"return_1y" numeric(8, 4),
	"return_3y" numeric(8, 4),
	"return_5y" numeric(8, 4),
	"return_since_inception" numeric(8, 4),
	"volatility" numeric(8, 4),
	"max_drawdown" numeric(8, 4),
	"sharpe_ratio" numeric(8, 4),
	"sortino_ratio" numeric(8, 4),
	"risk_score" integer,
	"isin" text,
	"sebi_id" text,
	"inception_date" date,
	"description" text,
	"investment_objective" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "aif_master_registration_no_unique" UNIQUE("registration_no")
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
CREATE TABLE "api_provider_pricing" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_name" varchar(100) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"description" text,
	"cost_per_call" numeric(10, 4) DEFAULT '0' NOT NULL,
	"currency" varchar(10) DEFAULT 'INR',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "api_provider_pricing_provider_name_unique" UNIQUE("provider_name")
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
CREATE TABLE "api_usage_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(50) NOT NULL,
	"endpoint" varchar(200) NOT NULL,
	"method" varchar(10) DEFAULT 'GET',
	"request_params" jsonb DEFAULT '{}'::jsonb,
	"cache_hit" boolean DEFAULT false,
	"cache_key" varchar(200),
	"estimated_cost_inr" numeric,
	"response_status" integer,
	"response_time_ms" integer,
	"requested_by" varchar,
	"request_context" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "appointment_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar NOT NULL,
	"previous_status" varchar,
	"new_status" varchar NOT NULL,
	"created_by_user_id" varchar,
	"created_by_role" varchar,
	"created_by_name" varchar,
	"admin_user_id" varchar,
	"admin_name" varchar,
	"admin_action" varchar,
	"admin_reason" text,
	"cost_centre_id" varchar,
	"cost_centre_name" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
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
CREATE TABLE "asset_class_insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_class" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text NOT NULL,
	"detailed_content" text,
	"key_metrics" jsonb DEFAULT '{}'::jsonb,
	"current_trends" jsonb DEFAULT '[]'::jsonb,
	"featured_products" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"display_order" integer DEFAULT 0,
	"created_by" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "asset_metadata_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(50) NOT NULL,
	"identifier_type" varchar(20) NOT NULL,
	"name" varchar(300) NOT NULL,
	"category" varchar(100),
	"sub_category" varchar(100),
	"amc_name" varchar(200),
	"scheme_type" varchar(50),
	"isin" varchar(20),
	"exchange" varchar(20),
	"sector" varchar(100),
	"industry" varchar(100),
	"latest_nav" numeric,
	"latest_nav_date" date,
	"source" varchar(30) NOT NULL,
	"last_updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "bank_connectors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_code" varchar NOT NULL,
	"bank_name" varchar NOT NULL,
	"connector_type" "bank_connector_type" NOT NULL,
	"api_endpoint" varchar,
	"sftp_host" varchar,
	"sftp_port" integer,
	"sftp_path" varchar,
	"portal_url" varchar,
	"auth_type" varchar,
	"credentials_ref" varchar,
	"priority" integer DEFAULT 50,
	"is_active" boolean DEFAULT true,
	"supported_loan_types" text[] DEFAULT ARRAY[]::text[],
	"min_amount" numeric(15, 2),
	"max_amount" numeric(15, 2),
	"min_tenure" integer,
	"max_tenure" integer,
	"expected_response_time" integer,
	"auto_escalate_after" integer,
	"interest_rate_min" numeric(5, 2),
	"interest_rate_max" numeric(5, 2),
	"processing_fee_percent" numeric(5, 2),
	"last_sync_at" timestamp,
	"success_rate" numeric(5, 2),
	"avg_response_time" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bank_connectors_bank_code_unique" UNIQUE("bank_code")
);
--> statement-breakpoint
CREATE TABLE "bank_eligibility_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_code" varchar NOT NULL,
	"product_type" varchar NOT NULL,
	"allowed_employment_types" text[] DEFAULT '{}',
	"min_cibil_score" integer DEFAULT 650,
	"max_cibil_score" integer DEFAULT 900,
	"min_monthly_income" numeric(12, 2) DEFAULT '20000',
	"max_monthly_income" numeric(12, 2),
	"min_business_vintage_months" integer,
	"min_annual_turnover" numeric(15, 2),
	"min_loan_amount" numeric(15, 2) DEFAULT '50000',
	"max_loan_amount" numeric(15, 2),
	"min_tenure_months" integer DEFAULT 12,
	"max_tenure_months" integer DEFAULT 60,
	"allowed_property_types" text[] DEFAULT '{}',
	"max_ltv_ratio" numeric(5, 2),
	"min_age" integer DEFAULT 21,
	"max_age" integer DEFAULT 60,
	"allowed_cities" text[] DEFAULT '{}',
	"excluded_cities" text[] DEFAULT '{}',
	"routing_priority" integer DEFAULT 100,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_mandates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"bank_account_id" varchar,
	"umrn" varchar,
	"mandate_type" varchar NOT NULL,
	"bank_account_number" varchar NOT NULL,
	"bank_ifsc" varchar NOT NULL,
	"bank_name" varchar,
	"account_holder_name" varchar,
	"max_amount" numeric(15, 2) NOT NULL,
	"frequency" varchar DEFAULT 'monthly',
	"start_date" date NOT NULL,
	"end_date" date,
	"status" varchar DEFAULT 'pending',
	"verification_reference" varchar,
	"verified_at" timestamp,
	"purpose" varchar DEFAULT 'mutual_fund_sip',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bbps_billers_biller_code_unique" UNIQUE("biller_code")
);
--> statement-breakpoint
CREATE TABLE "bbps_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_name" varchar NOT NULL,
	"category_code" varchar NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bbps_categories_category_code_unique" UNIQUE("category_code")
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
CREATE TABLE "bond_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"watchlist_id" varchar,
	"alert_type" varchar NOT NULL,
	"isin" varchar NOT NULL,
	"bond_name" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"previous_value" numeric(15, 4),
	"current_value" numeric(15, 4),
	"change_percentage" numeric(8, 4),
	"status" varchar DEFAULT 'unread' NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bond_buy_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_user_id" varchar NOT NULL,
	"instrument_type" varchar NOT NULL,
	"government_security_id" varchar,
	"corporate_bond_id" varchar,
	"isin" varchar NOT NULL,
	"bond_name" text NOT NULL,
	"bond_type" varchar NOT NULL,
	"coupon_rate" numeric(8, 4),
	"maturity_date" date,
	"credit_rating" varchar,
	"is_listed" boolean DEFAULT true,
	"face_value" numeric(15, 2) NOT NULL,
	"quantity" bigint NOT NULL,
	"max_price" numeric(15, 4) NOT NULL,
	"target_price" numeric(15, 4),
	"target_yield" numeric(8, 4),
	"status" varchar DEFAULT 'pending' NOT NULL,
	"quantity_filled" bigint DEFAULT 0,
	"valid_until" timestamp,
	"preferred_lot_size" bigint,
	"max_settlement_days" integer DEFAULT 3,
	"preferred_rating_min" varchar,
	"notes" text,
	"kyc_tier" integer DEFAULT 1,
	"kyc_verified" boolean DEFAULT false,
	"funds_verified" boolean DEFAULT false,
	"compliance_status" varchar DEFAULT 'pending',
	"compliance_block_reasons" jsonb DEFAULT '[]'::jsonb,
	"risk_acknowledged" boolean DEFAULT false,
	"risk_acknowledged_at" timestamp,
	"sebi_disclosures_acknowledged" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bond_calendar_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar NOT NULL,
	"event_title" varchar NOT NULL,
	"event_description" text,
	"event_date" date NOT NULL,
	"event_time" varchar,
	"end_date" date,
	"isin" varchar,
	"instrument_name" varchar NOT NULL,
	"instrument_type" varchar NOT NULL,
	"issuer_name" varchar,
	"issuer_type" varchar,
	"face_value" numeric(15, 2),
	"issue_size" numeric(18, 2),
	"coupon_rate" numeric(6, 3),
	"yield_indicative" numeric(8, 4),
	"credit_rating" varchar,
	"min_investment" numeric(15, 2),
	"max_investment" numeric(18, 2),
	"lot_size" integer,
	"retail_quota" numeric(5, 2),
	"source" varchar NOT NULL,
	"source_url" text,
	"external_id" varchar,
	"status" varchar DEFAULT 'upcoming',
	"is_highlighted" boolean DEFAULT false,
	"tags" text[] DEFAULT '{}'::text[],
	"additional_info" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_synced_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "bond_catalog" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar NOT NULL,
	"source_id" varchar,
	"isin" varchar NOT NULL,
	"bond_name" varchar NOT NULL,
	"issuer_name" varchar NOT NULL,
	"instrument_type" varchar NOT NULL,
	"is_listed" boolean DEFAULT true,
	"exchange" varchar,
	"face_value" numeric(15, 2) DEFAULT '1000',
	"coupon_rate" numeric(8, 4),
	"coupon_frequency" varchar,
	"issue_date" date,
	"maturity_date" date,
	"clean_price" numeric(15, 4),
	"dirty_price" numeric(15, 4),
	"accrued_interest" numeric(15, 4),
	"yield_to_maturity" numeric(8, 4),
	"credit_rating" varchar,
	"rating_agency" varchar,
	"min_investment" numeric(15, 2),
	"lot_size" integer DEFAULT 1,
	"tax_category" varchar,
	"tds_applicable" boolean DEFAULT true,
	"tds_rate" numeric(5, 2),
	"fee_profile_id" varchar,
	"fee_override_id" varchar,
	"net_yield_to_maturity" numeric(8, 4),
	"status" varchar DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"published_by" varchar,
	"unpublished_at" timestamp,
	"unpublished_by" varchar,
	"unpublish_reason" text,
	"compliance_approved" boolean DEFAULT false,
	"compliance_approved_by" varchar,
	"compliance_approved_at" timestamp,
	"regulatory_tier" varchar,
	"kyc_tier_required" varchar DEFAULT 'basic',
	"last_sync_at" timestamp,
	"sync_errors" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" varchar,
	"updated_by" varchar
);
--> statement-breakpoint
CREATE TABLE "bond_commission_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bond_type" varchar NOT NULL,
	"bond_type_label" varchar NOT NULL,
	"brokerage_bps" numeric(8, 4) DEFAULT '5',
	"brokerage_min_amount" numeric(15, 2) DEFAULT '10',
	"brokerage_max_amount" numeric(15, 2) DEFAULT '1000',
	"platform_fee_type" varchar DEFAULT 'fixed',
	"platform_fee_fixed" numeric(15, 2) DEFAULT '25',
	"platform_fee_percent" numeric(8, 4) DEFAULT '0',
	"transaction_charge_bps" numeric(8, 4) DEFAULT '0.5',
	"stamp_duty_bps" numeric(8, 4) DEFAULT '1',
	"sebi_turnover_fee_bps" numeric(8, 4) DEFAULT '0.0001',
	"gst_rate" numeric(5, 2) DEFAULT '18',
	"is_active" boolean DEFAULT true,
	"tiered_pricing" jsonb DEFAULT '[]'::jsonb,
	"last_updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bond_commission_config_bond_type_unique" UNIQUE("bond_type")
);
--> statement-breakpoint
CREATE TABLE "bond_comparison_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"session_token" varchar,
	"bond_isins" text[] NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "bond_coupon_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"holding_id" varchar,
	"isin" varchar NOT NULL,
	"bond_name" text NOT NULL,
	"bond_type" varchar NOT NULL,
	"payment_type" varchar NOT NULL,
	"coupon_rate" numeric(8, 4) NOT NULL,
	"face_value_held" numeric(15, 2) NOT NULL,
	"gross_amount" numeric(15, 2) NOT NULL,
	"tds_deducted" numeric(15, 2) DEFAULT '0',
	"net_amount" numeric(15, 2) NOT NULL,
	"tds_rate" numeric(5, 2),
	"record_date" date NOT NULL,
	"payment_date" date NOT NULL,
	"actual_payment_date" date,
	"payment_status" varchar DEFAULT 'scheduled',
	"payment_reference" varchar,
	"credited_to_account" varchar,
	"form_26as_reflected" boolean DEFAULT false,
	"tan_number" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bond_deals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sell_listing_id" varchar NOT NULL,
	"buy_request_id" varchar NOT NULL,
	"seller_user_id" varchar NOT NULL,
	"buyer_user_id" varchar NOT NULL,
	"instrument_type" varchar NOT NULL,
	"government_security_id" varchar,
	"corporate_bond_id" varchar,
	"isin" varchar NOT NULL,
	"bond_name" text NOT NULL,
	"bond_type" varchar NOT NULL,
	"quantity" bigint NOT NULL,
	"agreed_price" numeric(15, 4) NOT NULL,
	"accrued_interest" numeric(15, 4) DEFAULT '0',
	"dirty_price" numeric(15, 4),
	"total_value" numeric(20, 2) NOT NULL,
	"effective_yield" numeric(8, 4),
	"status" varchar DEFAULT 'pending' NOT NULL,
	"escrow_id" varchar,
	"escrowed_at" timestamp,
	"payment_gateway" varchar,
	"payment_transaction_id" varchar,
	"payment_completed_at" timestamp,
	"transfer_mode" varchar,
	"transfer_reference_number" varchar,
	"bonds_transferred_at" timestamp,
	"settlement_date" date,
	"actual_settlement_date" date,
	"platform_fee" numeric(15, 2),
	"seller_fee" numeric(15, 2),
	"buyer_fee" numeric(15, 2),
	"stamp_duty" numeric(15, 2),
	"tds_on_interest" numeric(15, 2) DEFAULT '0',
	"tds_deducted_by" varchar,
	"tds_certificate_number" varchar,
	"seller_payout" numeric(20, 2),
	"buyer_charge" numeric(20, 2),
	"compliance_checked" boolean DEFAULT false,
	"compliance_approved_by" varchar,
	"compliance_approved_at" timestamp,
	"compliance_notes" text,
	"sebi_reporting_required" boolean DEFAULT false,
	"sebi_reported_at" timestamp,
	"rbi_reporting_required" boolean DEFAULT false,
	"rbi_reported_at" timestamp,
	"matched_at" timestamp DEFAULT now(),
	"matched_by" varchar,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bond_fee_override_audit" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"override_id" varchar,
	"isin" varchar NOT NULL,
	"bond_name" varchar,
	"instrument_type" varchar,
	"action" varchar NOT NULL,
	"previous_platform_fee" numeric(10, 4),
	"new_platform_fee" numeric(10, 4),
	"previous_brokerage_fee" numeric(10, 4),
	"new_brokerage_fee" numeric(10, 4),
	"previous_transaction_charges" numeric(10, 4),
	"new_transaction_charges" numeric(10, 4),
	"previous_net_yield" numeric(8, 4),
	"new_net_yield" numeric(8, 4),
	"yield_impact_bps" integer,
	"override_reason" text,
	"regulatory_violations" jsonb,
	"performed_by" varchar,
	"approved_by" varchar,
	"performed_at" timestamp DEFAULT now(),
	"retention_expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "bond_fee_overrides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"government_security_id" varchar,
	"corporate_bond_id" varchar,
	"isin" varchar,
	"platform_fee_override" numeric(10, 4),
	"brokerage_fee_override" numeric(10, 4),
	"transaction_charges_override" numeric(10, 4),
	"override_reason" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" varchar
);
--> statement-breakpoint
CREATE TABLE "bond_fee_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instrument_type" varchar NOT NULL,
	"instrument_label" varchar NOT NULL,
	"platform_fee_type" varchar DEFAULT 'percentage',
	"platform_fee_value" numeric(10, 4) DEFAULT '0',
	"platform_fee_min" numeric(10, 2),
	"platform_fee_max" numeric(10, 2),
	"brokerage_fee_type" varchar DEFAULT 'percentage',
	"brokerage_fee_value" numeric(10, 4) DEFAULT '0',
	"brokerage_fee_min" numeric(10, 2),
	"brokerage_fee_max" numeric(10, 2),
	"transaction_charges" numeric(10, 4) DEFAULT '0',
	"transaction_charges_type" varchar DEFAULT 'percentage',
	"regulatory_max_brokerage" numeric(10, 4),
	"regulatory_max_platform_fee" numeric(10, 4),
	"gst_applicable" boolean DEFAULT true,
	"gst_rate" numeric(5, 2) DEFAULT '18',
	"stamp_duty_applicable" boolean DEFAULT false,
	"stamp_duty_rate" numeric(5, 4) DEFAULT '0',
	"retail_multiplier" numeric(5, 2) DEFAULT '1.00',
	"hni_multiplier" numeric(5, 2) DEFAULT '1.00',
	"institutional_multiplier" numeric(5, 2) DEFAULT '0.50',
	"buy_fee_multiplier" numeric(5, 2) DEFAULT '1.00',
	"sell_fee_multiplier" numeric(5, 2) DEFAULT '1.00',
	"regulatory_reference" varchar,
	"regulatory_notes" text,
	"is_active" boolean DEFAULT true,
	"effective_from" timestamp DEFAULT now(),
	"effective_until" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" varchar,
	"updated_by" varchar
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
CREATE TABLE "bond_marketplace_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"user_email" varchar,
	"user_role" varchar,
	"action" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"isin" varchar,
	"bond_type" varchar,
	"instrument_type" varchar,
	"before_value" jsonb,
	"after_value" jsonb,
	"change_description" text,
	"compliance_related" boolean DEFAULT false,
	"risk_level" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"session_id" varchar,
	"timestamp" timestamp DEFAULT now(),
	"retention_expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "bond_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"bond_id" varchar,
	"isin" varchar NOT NULL,
	"issuer_name" varchar,
	"fiscal_year" varchar(10) NOT NULL,
	"coupon_rate" numeric(8, 4),
	"current_yield" numeric(8, 4),
	"yield_to_maturity" numeric(10, 4),
	"yield_to_call" numeric(10, 4),
	"yield_to_worst" numeric(10, 4),
	"yield_spread" numeric(10, 4),
	"g_spread" numeric(10, 4),
	"z_spread" numeric(10, 4),
	"macaulay_duration" numeric(10, 4),
	"modified_duration" numeric(10, 4),
	"effective_duration" numeric(10, 4),
	"convexity" numeric(12, 4),
	"dv01" numeric(15, 6),
	"credit_rating" varchar(10),
	"credit_rating_agency" varchar(50),
	"credit_spread" numeric(10, 4),
	"default_probability" numeric(10, 6),
	"recovery_rate" numeric(8, 4),
	"issuer_debt_to_equity" numeric(10, 4),
	"issuer_interest_coverage" numeric(12, 4),
	"issuer_current_ratio" numeric(10, 4),
	"face_value" numeric(15, 2),
	"current_price" numeric(15, 4),
	"accrued_interest" numeric(15, 4),
	"clean_price" numeric(15, 4),
	"dirty_price" numeric(15, 4),
	"issue_date" date,
	"maturity_date" date,
	"next_coupon_date" date,
	"days_to_maturity" integer,
	"years_to_maturity" numeric(8, 4),
	"is_callable" boolean DEFAULT false,
	"call_date" date,
	"trading_volume_30d" numeric(20, 2),
	"bid_ask_spread" numeric(10, 4),
	"data_source" varchar(50),
	"calculated_at" timestamp DEFAULT now(),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bond_ncd_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"issue_id" varchar NOT NULL,
	"application_number" varchar NOT NULL,
	"application_date" timestamp DEFAULT now(),
	"investor_category" varchar NOT NULL,
	"series_options" jsonb DEFAULT '[]'::jsonb,
	"total_quantity" integer NOT NULL,
	"face_value" numeric(15, 2) NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"payment_status" varchar DEFAULT 'pending',
	"payment_method" varchar,
	"payment_reference" varchar,
	"payment_date" timestamp,
	"asba_account_number" varchar,
	"asba_bank_name" varchar,
	"asba_blocked_amount" numeric(15, 2),
	"demat_account_number" varchar NOT NULL,
	"dp_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"application_status" varchar DEFAULT 'submitted',
	"allotted_quantity" integer,
	"allotted_amount" numeric(15, 2),
	"allotment_date" date,
	"refund_amount" numeric(15, 2),
	"refund_date" date,
	"registrar_application_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bond_ncd_applications_application_number_unique" UNIQUE("application_number")
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
	"inventory_sale" boolean DEFAULT false,
	"purchase_cost" numeric(15, 2),
	"total_purchase_cost" numeric(15, 2),
	"inventory_item_id" varchar,
	"profit_margin" numeric(15, 2),
	"brokerage_fee" numeric(15, 2),
	"brokerage_rate" numeric(8, 4),
	"zoho_invoice_id" varchar,
	"zoho_expense_id" varchar,
	"zoho_synced_at" timestamp,
	"zoho_sync_status" varchar(50),
	"order_placed_by" varchar,
	"remarks" text,
	"order_date" timestamp DEFAULT now(),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "bond_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "bond_risk_disclosure_acknowledgments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"disclosure_category" varchar NOT NULL,
	"disclosure_version" varchar DEFAULT '1.0',
	"bond_type" varchar,
	"isin" varchar,
	"credit_rating_category" varchar,
	"acknowledged" boolean DEFAULT false,
	"acknowledged_at" timestamp,
	"acknowledged_from_ip" varchar,
	"content_hash" varchar,
	"valid_until" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bond_risk_disclosure_attestations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"order_id" varchar,
	"order_type" varchar,
	"isin" varchar NOT NULL,
	"bond_name" varchar NOT NULL,
	"instrument_type" varchar NOT NULL,
	"transaction_value" numeric(15, 2) NOT NULL,
	"disclosures_acknowledged" jsonb NOT NULL,
	"all_disclosures_accepted" boolean DEFAULT false,
	"attested_at" timestamp DEFAULT now(),
	"ip_address" varchar,
	"user_agent" text,
	"retention_expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "bond_sell_listings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_user_id" varchar NOT NULL,
	"instrument_type" varchar NOT NULL,
	"government_security_id" varchar,
	"corporate_bond_id" varchar,
	"isin" varchar NOT NULL,
	"bond_name" text NOT NULL,
	"bond_type" varchar NOT NULL,
	"coupon_rate" numeric(8, 4),
	"maturity_date" date,
	"credit_rating" varchar,
	"is_listed" boolean DEFAULT true,
	"face_value" numeric(15, 2) NOT NULL,
	"quantity" bigint NOT NULL,
	"ask_price" numeric(15, 4) NOT NULL,
	"ask_yield" numeric(8, 4),
	"floor_price" numeric(15, 4) NOT NULL,
	"accrued_interest" numeric(15, 4),
	"last_coupon_date" date,
	"next_coupon_date" date,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"quantity_remaining" bigint,
	"valid_until" timestamp,
	"auto_renew" boolean DEFAULT false,
	"minimum_lot_size" bigint DEFAULT 1,
	"settlement_days" integer DEFAULT 2,
	"notes" text,
	"demat_account_number" varchar,
	"holding_verified" boolean DEFAULT false,
	"holding_verified_at" timestamp,
	"holding_proof_url" text,
	"kyc_tier" integer DEFAULT 1,
	"kyc_verified" boolean DEFAULT false,
	"compliance_status" varchar DEFAULT 'pending',
	"compliance_block_reasons" jsonb DEFAULT '[]'::jsonb,
	"risk_acknowledged" boolean DEFAULT false,
	"risk_acknowledged_at" timestamp,
	"tds_applicable" boolean DEFAULT true,
	"tds_rate" numeric(5, 2) DEFAULT '10.00',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bond_suitability_checks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"check_type" varchar NOT NULL,
	"kyc_level" varchar NOT NULL,
	"kyc_verified" boolean DEFAULT false,
	"ckyc_number" varchar,
	"kra_status" varchar,
	"demat_verified" boolean DEFAULT false,
	"dp_id" varchar,
	"client_id" varchar,
	"demat_account_number" varchar,
	"depository_participant" varchar,
	"investor_risk_profile" varchar,
	"max_credit_rating_allowed" varchar,
	"high_risk_debt_acknowledged" boolean DEFAULT false,
	"default_risk_acknowledged" boolean DEFAULT false,
	"reinvestment_risk_acknowledged" boolean DEFAULT false,
	"liquidity_risk_acknowledged" boolean DEFAULT false,
	"is_accredited_investor" boolean DEFAULT false,
	"accredited_investor_certificate_id" varchar,
	"accredited_investor_valid_until" date,
	"max_single_bond_exposure" numeric(15, 2),
	"max_issuer_exposure" numeric(15, 2),
	"max_fixed_income_allocation" numeric(5, 2),
	"suitability_result" varchar NOT NULL,
	"restriction_level" varchar,
	"restriction_details" text,
	"ip_address" varchar,
	"user_agent" text,
	"device_fingerprint" varchar,
	"valid_from" timestamp DEFAULT now(),
	"valid_until" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bond_suitability_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"isin" varchar NOT NULL,
	"risk_alignment_score" integer NOT NULL,
	"horizon_alignment_score" integer NOT NULL,
	"liquidity_score" integer NOT NULL,
	"yield_expectation_score" integer NOT NULL,
	"tax_efficiency_score" integer NOT NULL,
	"overall_suitability_score" integer NOT NULL,
	"suitability_category" varchar NOT NULL,
	"reasoning_summary" text,
	"warnings" jsonb,
	"calculated_at" timestamp DEFAULT now(),
	"valid_until" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bond_watchlist" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"bond_id" varchar,
	"bond_type" varchar NOT NULL,
	"isin" varchar,
	"issue_id" varchar,
	"bond_name" text NOT NULL,
	"issuer" varchar NOT NULL,
	"alert_on_price_change" boolean DEFAULT true,
	"price_alert_threshold" numeric(5, 2),
	"alert_on_yield_change" boolean DEFAULT false,
	"yield_alert_threshold" numeric(5, 2),
	"alert_on_rating_change" boolean DEFAULT true,
	"alert_on_issue_open" boolean DEFAULT true,
	"target_buy_price" numeric(15, 4),
	"target_buy_yield" numeric(8, 4),
	"notes" text,
	"is_active" boolean DEFAULT true,
	"added_at" timestamp DEFAULT now(),
	"last_alert_sent" timestamp
);
--> statement-breakpoint
CREATE TABLE "buy_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_user_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"quantity" bigint NOT NULL,
	"max_price" numeric(20, 2) NOT NULL,
	"target_price" numeric(20, 2),
	"status" varchar DEFAULT 'pending' NOT NULL,
	"quantity_filled" bigint DEFAULT 0,
	"valid_until" timestamp,
	"preferred_lot_size" bigint,
	"notes" text,
	"kyc_verified" boolean DEFAULT false,
	"funds_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ca_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"membership_number" varchar NOT NULL,
	"membership_type" varchar NOT NULL,
	"cop_number" varchar,
	"full_name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"mobile" varchar,
	"specializations" jsonb DEFAULT '[]'::jsonb,
	"max_cases_per_month" integer DEFAULT 50,
	"current_case_count" integer DEFAULT 0,
	"is_available" boolean DEFAULT true,
	"average_rating" numeric(3, 2) DEFAULT '5.00',
	"total_reviews" integer DEFAULT 0,
	"base_fee_itr1" numeric(10, 2) DEFAULT '500',
	"base_fee_itr2" numeric(10, 2) DEFAULT '1500',
	"base_fee_itr3" numeric(10, 2) DEFAULT '3000',
	"base_fee_itr4" numeric(10, 2) DEFAULT '2000',
	"status" varchar DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ca_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "ca_verification_status" (
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
	CONSTRAINT "ca_verification_status_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "cache_refresh_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" varchar(50) NOT NULL,
	"cache_table" varchar(100) NOT NULL,
	"asset_type" varchar(50),
	"user_id" varchar,
	"status" varchar(20) DEFAULT 'pending',
	"priority" integer DEFAULT 5,
	"started_at" timestamp,
	"completed_at" timestamp,
	"items_processed" integer DEFAULT 0,
	"items_failed" integer DEFAULT 0,
	"last_error" text,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"scheduled_at" timestamp DEFAULT now() NOT NULL,
	"next_run_at" timestamp,
	"cron_expression" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cache_refresh_schedule" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cache_type" varchar(50) NOT NULL,
	"refresh_frequency" varchar(30) NOT NULL,
	"cron_expression" varchar(50),
	"last_run_at" timestamp,
	"last_run_status" varchar(20),
	"last_run_records_processed" integer,
	"last_run_errors" jsonb DEFAULT '[]'::jsonb,
	"next_run_at" timestamp,
	"is_enabled" boolean DEFAULT true,
	"priority" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_sid" varchar(100) NOT NULL,
	"account_sid" varchar(100),
	"direction" varchar(20) DEFAULT 'inbound' NOT NULL,
	"status" varchar(30) DEFAULT 'received' NOT NULL,
	"caller_number" varchar(50) NOT NULL,
	"called_number" varchar(50) NOT NULL,
	"caller_city" varchar(100),
	"caller_state" varchar(100),
	"caller_country" varchar(100),
	"duration" integer DEFAULT 0,
	"user_id" varchar,
	"assigned_agent_id" varchar,
	"callback_requested" boolean DEFAULT true,
	"callback_status" varchar(30) DEFAULT 'pending',
	"callback_scheduled_at" timestamp,
	"callback_completed_at" timestamp,
	"callback_completed_by" varchar,
	"recording_url" text,
	"recording_sid" varchar(100),
	"admin_notes" text,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"read_by" varchar,
	"greeting_played" text,
	"call_started_at" timestamp DEFAULT now() NOT NULL,
	"call_ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "call_logs_call_sid_unique" UNIQUE("call_sid")
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
	"order_status" varchar,
	"response_message" text,
	"return_url" text,
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
	CONSTRAINT "cashfree_transactions_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "certification_quizzes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certification_level" varchar(5) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"passing_score" integer DEFAULT 70 NOT NULL,
	"time_limit_minutes" integer DEFAULT 30,
	"max_attempts" integer DEFAULT 3,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "ckyc_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar,
	"user_id" varchar,
	"pan_number" varchar(10),
	"event_type" varchar(50) NOT NULL,
	"event_subtype" varchar(50),
	"previous_state" varchar(50),
	"new_state" varchar(50),
	"event_data" jsonb DEFAULT '{}'::jsonb,
	"actor_id" varchar,
	"actor_role" varchar(50),
	"actor_name" varchar(255),
	"checksum" varchar(64),
	"previous_log_id" varchar,
	"is_compliance_event" boolean DEFAULT false,
	"is_escalation" boolean DEFAULT false,
	"is_sla_related" boolean DEFAULT false,
	"event_timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ckyc_deferred_cases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"pan_number" varchar(10) NOT NULL,
	"status" varchar(50) DEFAULT 'ckyc_deferred' NOT NULL,
	"deferral_code" varchar(50) NOT NULL,
	"deferral_message" text,
	"last_provider_attempted" varchar(50),
	"fallback_attempts" jsonb DEFAULT '[]'::jsonb,
	"sla_started_at" timestamp DEFAULT now() NOT NULL,
	"sla_deadline" timestamp NOT NULL,
	"sla_breach" boolean DEFAULT false,
	"sla_breached_at" timestamp,
	"assigned_to_admin" varchar,
	"admin_action" varchar(50),
	"admin_action_reason" text,
	"admin_action_at" timestamp,
	"resolved_at" timestamp,
	"resolution_method" varchar(50),
	"resolution_notes" text,
	"escalation_level" integer DEFAULT 0,
	"escalated_at" timestamp,
	"escalated_to" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "ckyc_escalation_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"escalation_level" integer NOT NULL,
	"escalated_from" integer DEFAULT 0 NOT NULL,
	"escalated_to_user_id" varchar,
	"escalated_to_email" varchar(255),
	"escalated_to_role" varchar(50),
	"escalation_trigger" varchar(50) NOT NULL,
	"hours_overdue" integer DEFAULT 0,
	"email_sent" boolean DEFAULT false,
	"email_sent_at" timestamp,
	"email_message_id" varchar(255),
	"acknowledged_at" timestamp,
	"acknowledged_by" varchar,
	"escalated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ckyc_mock_blocked_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempted_provider" varchar(50) DEFAULT 'mock' NOT NULL,
	"user_id" varchar,
	"pan_number" varchar(10),
	"blocked_reason" text NOT NULL,
	"is_security_event" boolean DEFAULT true NOT NULL,
	"environment_mode" varchar(20) NOT NULL,
	"request_path" varchar(255),
	"ip_address" varchar(50),
	"user_agent" text,
	"attempted_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "ckyc_provider_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" varchar NOT NULL,
	"provider_code" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"change_reason" text,
	"performed_by" varchar,
	"performed_by_role" varchar(50),
	"performed_by_ip" varchar(45),
	"is_system_action" boolean DEFAULT false,
	"system_trigger" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ckyc_provider_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_code" varchar(50) NOT NULL,
	"provider_name" varchar(100) NOT NULL,
	"provider_description" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"environment" varchar(20) DEFAULT 'all',
	"last_health_check" timestamp,
	"health_status" varchar(20) DEFAULT 'unknown',
	"consecutive_failures" integer DEFAULT 0,
	"auto_disabled_at" timestamp,
	"api_config" jsonb DEFAULT '{}'::jsonb,
	"eligibility_rules" jsonb DEFAULT '{}'::jsonb,
	"rate_limit_per_minute" integer DEFAULT 100,
	"rate_limit_per_day" integer DEFAULT 10000,
	"current_minute_count" integer DEFAULT 0,
	"current_day_count" integer DEFAULT 0,
	"rate_limit_reset_at" timestamp,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	CONSTRAINT "ckyc_provider_config_provider_code_unique" UNIQUE("provider_code")
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
CREATE TABLE "ckyc_verification_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"pan_number" varchar(10) NOT NULL,
	"request_type" varchar(50) DEFAULT 'verification',
	"selected_provider" varchar(50) NOT NULL,
	"provider_selection_reason" text,
	"fallback_attempts" jsonb DEFAULT '[]'::jsonb,
	"request_payload" jsonb,
	"response_status" varchar(50),
	"response_code" varchar(50),
	"response_message" text,
	"ckyc_found" boolean,
	"ckyc_kin" varchar(50),
	"ckyc_status" varchar(50),
	"response_time_ms" integer,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
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
	"data_type" varchar,
	"enrichment_source" varchar,
	"raw_data" jsonb,
	"processed_data" jsonb,
	"is_processed" boolean DEFAULT false,
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
CREATE TABLE "client_portfolio_aif" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"added_by_user_id" varchar,
	"aif_id" varchar,
	"aif_name" text NOT NULL,
	"registration_no" text,
	"category" text,
	"subcategory" text,
	"commitment_amount" numeric(15, 2) NOT NULL,
	"capital_called" numeric(15, 2) NOT NULL,
	"capital_uncalled" numeric(15, 2),
	"invested_date" date NOT NULL,
	"lockin_end_date" date,
	"current_units" numeric(15, 4),
	"entry_nav" numeric(15, 4),
	"latest_nav" numeric(15, 4),
	"last_nav_date" date,
	"cost_of_investment" numeric(15, 2),
	"current_value" numeric(15, 2),
	"unrealized_gain_loss" numeric(15, 2),
	"unrealized_gain_loss_percent" numeric(8, 4),
	"distributions_received" numeric(15, 2) DEFAULT '0',
	"last_distribution_date" date,
	"documents" jsonb DEFAULT '[]'::jsonb,
	"entry_status" text DEFAULT 'pending',
	"approved_by_user_id" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_portfolio_mld" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"added_by_user_id" varchar,
	"mld_id" varchar,
	"isin" text NOT NULL,
	"mld_name" text NOT NULL,
	"issuer" text,
	"underlying" text,
	"payoff_type" text,
	"purchase_price" numeric(15, 4) NOT NULL,
	"purchase_date" date NOT NULL,
	"quantity" numeric(15, 2) NOT NULL,
	"face_value" numeric(15, 2),
	"total_invested" numeric(15, 2),
	"maturity_date" date,
	"expected_payoff_scenario" text,
	"expected_payoff_amount" numeric(15, 2),
	"current_price" numeric(15, 4),
	"last_price_date" date,
	"current_value" numeric(15, 2),
	"unrealized_gain_loss" numeric(15, 2),
	"unrealized_gain_loss_percent" numeric(8, 4),
	"risk_score" integer,
	"credit_risk_exposure" numeric(15, 2),
	"documents" jsonb DEFAULT '[]'::jsonb,
	"entry_status" text DEFAULT 'pending',
	"approved_by_user_id" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_portfolio_pms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"added_by_user_id" varchar,
	"pms_id" varchar,
	"pms_name" text NOT NULL,
	"registration_no" text,
	"strategy" text,
	"invested_amount" numeric(15, 2) NOT NULL,
	"additional_infusions" numeric(15, 2) DEFAULT '0',
	"total_invested" numeric(15, 2),
	"start_date" date NOT NULL,
	"last_infusion_date" date,
	"corpus_value" numeric(15, 2),
	"latest_nav" numeric(15, 4),
	"last_nav_date" date,
	"current_value" numeric(15, 2),
	"unrealized_gain_loss" numeric(15, 2),
	"unrealized_gain_loss_percent" numeric(8, 4),
	"absolute_return" numeric(8, 4),
	"cagr" numeric(8, 4),
	"withdrawals_received" numeric(15, 2) DEFAULT '0',
	"last_withdrawal_date" date,
	"documents" jsonb DEFAULT '[]'::jsonb,
	"entry_status" text DEFAULT 'pending',
	"approved_by_user_id" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_risk_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"risk_category" varchar DEFAULT 'moderate' NOT NULL,
	"risk_score" integer,
	"time_horizon_years" integer DEFAULT 5,
	"liquidity_need" varchar DEFAULT 'medium',
	"tax_bracket" varchar,
	"investment_objectives" jsonb DEFAULT '[]'::jsonb,
	"product_restrictions" jsonb DEFAULT '[]'::jsonb,
	"max_equity_exposure" integer,
	"max_single_stock_exposure" integer DEFAULT 15,
	"max_single_amc_exposure" integer DEFAULT 25,
	"is_accredited_investor" boolean DEFAULT false,
	"is_pms_eligible" boolean DEFAULT false,
	"is_aif_eligible" boolean DEFAULT false,
	"last_assessed_at" timestamp DEFAULT now(),
	"assessment_method" varchar DEFAULT 'questionnaire',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "client_risk_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "client_segments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"client_type" varchar DEFAULT 'individual' NOT NULL,
	"segment" varchar NOT NULL,
	"segment_threshold" jsonb,
	"annual_investable_surplus" numeric(15, 2) NOT NULL,
	"net_worth" numeric(20, 2),
	"eligible_products" jsonb,
	"restricted_products" jsonb,
	"investment_caps" jsonb,
	"previous_segment" varchar,
	"segment_changed_at" timestamp,
	"segment_change_reason" text,
	"assessed_at" timestamp DEFAULT now(),
	"assessed_by" varchar DEFAULT 'system',
	"next_review_date" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "client_segments_user_id_unique" UNIQUE("user_id")
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
CREATE TABLE "client_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"type" varchar NOT NULL,
	"priority" varchar DEFAULT 'medium',
	"status" varchar DEFAULT 'pending',
	"due_date" date NOT NULL,
	"completed_at" timestamp,
	"action_label" varchar,
	"action_route" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "commission_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"commission_plan_id" integer NOT NULL,
	"field_changed" varchar(100) NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_by" integer NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE "commission_hierarchy_splits" (
	"id" serial PRIMARY KEY NOT NULL,
	"commission_plan_id" integer NOT NULL,
	"role_id" varchar(50) NOT NULL,
	"hierarchy_level" integer NOT NULL,
	"share_percentage" numeric(5, 2) NOT NULL,
	"passthrough_rule" "passthrough_rule" DEFAULT 'stop' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_payment_batches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar NOT NULL,
	"file_type" varchar NOT NULL,
	"source_type" varchar NOT NULL,
	"total_rows" integer DEFAULT 0,
	"processed_rows" integer DEFAULT 0,
	"matched_rows" integer DEFAULT 0,
	"unmatched_rows" integer DEFAULT 0,
	"disputed_rows" integer DEFAULT 0,
	"total_amount" numeric(15, 2) DEFAULT '0',
	"matched_amount" numeric(15, 2) DEFAULT '0',
	"status" varchar DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"uploaded_by" varchar,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "commission_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commission_ledger_id" varchar,
	"application_id" varchar,
	"paid_by" varchar NOT NULL,
	"payer_name" varchar,
	"payer_reference" varchar,
	"expected_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) NOT NULL,
	"payment_date" timestamp NOT NULL,
	"utr_number" varchar,
	"payment_mode" varchar,
	"match_status" varchar DEFAULT 'pending' NOT NULL,
	"match_variance" numeric(12, 2) DEFAULT '0',
	"matched_at" timestamp,
	"matched_by" varchar,
	"tolerance_amount" numeric(12, 2) DEFAULT '100',
	"dispute_reason" text,
	"dispute_raised_at" timestamp,
	"dispute_resolved_at" timestamp,
	"dispute_resolution" text,
	"revenue_status" varchar DEFAULT 'accrued' NOT NULL,
	"recognized_date" timestamp,
	"source_file_name" varchar,
	"source_file_row_num" integer,
	"upload_batch_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "commission_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_type" varchar(100) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "commission_plan_status" DEFAULT 'draft' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"regulatory_cap" numeric(5, 2),
	"change_reason" text,
	"created_by" integer NOT NULL,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_role_maps" (
	"id" serial PRIMARY KEY NOT NULL,
	"commission_plan_id" integer NOT NULL,
	"role_id" varchar(50) NOT NULL,
	"payout_percentage" numeric(5, 2) NOT NULL,
	"payout_mode" "payout_mode" DEFAULT 'upfront' NOT NULL,
	"min_cap" numeric(15, 2),
	"max_cap" numeric(15, 2),
	"validation_status" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commodities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"commodity_type" varchar(50) NOT NULL,
	"sub_type" varchar(50),
	"current_price" numeric(15, 4),
	"previous_close" numeric(15, 4),
	"day_change" numeric(10, 4),
	"day_change_percent" numeric(8, 4),
	"week_high" numeric(15, 4),
	"week_low" numeric(15, 4),
	"year_high" numeric(15, 4),
	"year_low" numeric(15, 4),
	"unit" varchar(20) DEFAULT 'gram',
	"currency" varchar(5) DEFAULT 'INR',
	"has_etf" boolean DEFAULT false,
	"has_sgb" boolean DEFAULT false,
	"has_physical" boolean DEFAULT false,
	"has_futures" boolean DEFAULT false,
	"returns_1w" numeric(8, 4),
	"returns_1m" numeric(8, 4),
	"returns_3m" numeric(8, 4),
	"returns_6m" numeric(8, 4),
	"returns_1y" numeric(8, 4),
	"returns_3y" numeric(8, 4),
	"returns_5y" numeric(8, 4),
	"volatility" numeric(8, 4),
	"beta" numeric(8, 4),
	"sharpe_ratio" numeric(8, 4),
	"global_demand" varchar(20),
	"supply_outlook" varchar(20),
	"inflation_hedge" boolean DEFAULT false,
	"safe_haven" boolean DEFAULT false,
	"is_published" boolean DEFAULT true,
	"min_investment" numeric(15, 2) DEFAULT '1000',
	"ai_sentiment" varchar(20),
	"ai_confidence" numeric(5, 2),
	"ai_rationale" text,
	"data_source" varchar DEFAULT 'mcx',
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "commodities_symbol_unique" UNIQUE("symbol")
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
CREATE TABLE "company_external_mapping" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"source" varchar NOT NULL,
	"external_id" varchar NOT NULL,
	"external_symbol" varchar,
	"match_method" varchar NOT NULL,
	"match_score" numeric(3, 2),
	"match_verified" boolean DEFAULT false,
	"locked" boolean DEFAULT false,
	"locked_at" timestamp,
	"locked_by" varchar,
	"lock_reason" text,
	"verified_by" varchar,
	"verified_at" timestamp,
	"verified_by_user_id" varchar,
	"last_fetched_at" timestamp,
	"fetch_success_count" integer DEFAULT 0,
	"fetch_failure_count" integer DEFAULT 0,
	"last_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_financials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"financial_year" varchar NOT NULL,
	"period_start" date,
	"period_end" date,
	"revenue" numeric(20, 2),
	"ebitda" numeric(20, 2),
	"ebit" numeric(20, 2),
	"pbt" numeric(20, 2),
	"pat" numeric(20, 2),
	"net_profit" numeric(20, 2),
	"total_assets" numeric(20, 2),
	"total_liabilities" numeric(20, 2),
	"networth" numeric(20, 2),
	"share_capital" numeric(20, 2),
	"reserves" numeric(20, 2),
	"total_debt" numeric(20, 2),
	"long_term_debt" numeric(20, 2),
	"short_term_debt" numeric(20, 2),
	"operating_cash_flow" numeric(20, 2),
	"investing_cash_flow" numeric(20, 2),
	"financing_cash_flow" numeric(20, 2),
	"free_cash_flow" numeric(20, 2),
	"data_source" varchar DEFAULT 'probe42',
	"verified" boolean DEFAULT false,
	"confidence_score" numeric(3, 2),
	"ai_allowed" boolean DEFAULT true,
	"locked_for_advisory" boolean DEFAULT false,
	"execution_allowed" boolean DEFAULT true,
	"data_quality_score" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_financials_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar,
	"cin" varchar(21) NOT NULL,
	"financial_year" varchar(10) NOT NULL,
	"quarter" varchar(5),
	"period_start" date,
	"period_end" date,
	"revenue" numeric,
	"ebitda" numeric,
	"ebit" numeric,
	"pbt" numeric,
	"pat" numeric,
	"net_profit" numeric,
	"total_assets" numeric,
	"total_liabilities" numeric,
	"networth" numeric,
	"share_capital" numeric,
	"reserves" numeric,
	"total_debt" numeric,
	"long_term_debt" numeric,
	"short_term_debt" numeric,
	"operating_cash_flow" numeric,
	"investing_cash_flow" numeric,
	"financing_cash_flow" numeric,
	"free_cash_flow" numeric,
	"ratios" jsonb DEFAULT '{}'::jsonb,
	"data_source" varchar(50) NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_master_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cin" varchar(21),
	"pan" varchar(10),
	"gstin" varchar(15),
	"tan" varchar(10),
	"company_name" varchar(500) NOT NULL,
	"company_status" varchar(50),
	"company_class" varchar(100),
	"company_category" varchar(100),
	"company_sub_category" varchar(100),
	"date_of_incorporation" date,
	"registration_number" varchar(50),
	"roc_state" varchar(50),
	"registered_address" text,
	"authorized_capital" numeric,
	"paid_up_capital" numeric,
	"directors" jsonb DEFAULT '[]'::jsonb,
	"data_source" varchar(50) NOT NULL,
	"source_reference_id" varchar(100),
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"last_verified_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_master_cache_cin_unique" UNIQUE("cin")
);
--> statement-breakpoint
CREATE TABLE "company_ratios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"financial_year" varchar NOT NULL,
	"pe_ratio" numeric(10, 2),
	"pb_ratio" numeric(10, 2),
	"ev_ebitda" numeric(10, 2),
	"price_to_sales" numeric(10, 2),
	"roe" numeric(10, 4),
	"roce" numeric(10, 4),
	"roa" numeric(10, 4),
	"margin_ebitda" numeric(10, 4),
	"margin_pat" numeric(10, 4),
	"margin_operating" numeric(10, 4),
	"debt_equity" numeric(10, 4),
	"debt_to_assets" numeric(10, 4),
	"interest_coverage" numeric(10, 2),
	"current_ratio" numeric(10, 2),
	"quick_ratio" numeric(10, 2),
	"asset_turnover" numeric(10, 4),
	"inventory_turnover" numeric(10, 2),
	"revenue_growth" numeric(10, 4),
	"profit_growth" numeric(10, 4),
	"data_source" varchar DEFAULT 'probe42',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "compound_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar(100) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"condition_logic" varchar(10) DEFAULT 'AND',
	"notify_email" boolean DEFAULT true,
	"notify_sms" boolean DEFAULT false,
	"notify_push" boolean DEFAULT true,
	"is_active" boolean DEFAULT true NOT NULL,
	"triggered_count" integer DEFAULT 0,
	"last_triggered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
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
	"updated_at" timestamp DEFAULT now()
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
	"instrument_status" varchar(16) DEFAULT 'HIDDEN' NOT NULL,
	"is_listed" boolean DEFAULT true NOT NULL,
	"liquidity_score" integer,
	"rating_current" varchar(10),
	"rating_trend" varchar(10),
	"structure_complexity" integer,
	"regulatory_eligibility" varchar(32),
	"bid_ask_spread" numeric(5, 2),
	"status_reason" text,
	"status_last_updated" timestamp,
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
CREATE TABLE "crm_activity_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"client_id" varchar,
	"activity_type" varchar NOT NULL,
	"action" varchar NOT NULL,
	"entity_id" varchar,
	"entity_type" varchar,
	"summary" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_client_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"tag" varchar NOT NULL,
	"color" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_interactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"direction" varchar,
	"subject" varchar,
	"description" text,
	"duration" integer,
	"outcome" varchar,
	"sentiment" varchar,
	"scheduled_at" timestamp,
	"completed_at" timestamp,
	"opportunity_id" varchar,
	"proposal_id" varchar,
	"task_id" varchar,
	"attachments" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_opportunities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"stage" varchar DEFAULT 'lead' NOT NULL,
	"probability" integer DEFAULT 0,
	"expected_amount" numeric(15, 2),
	"actual_amount" numeric(15, 2),
	"currency" varchar DEFAULT 'INR',
	"product_type" varchar,
	"products" jsonb,
	"expected_close_date" timestamp,
	"actual_close_date" timestamp,
	"source" varchar,
	"campaign" varchar,
	"status" varchar DEFAULT 'open',
	"lost_reason" varchar,
	"proposal_id" varchar,
	"priority" varchar DEFAULT 'medium',
	"score" integer,
	"notes" text,
	"tags" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"client_id" varchar,
	"title" varchar NOT NULL,
	"description" text,
	"type" varchar DEFAULT 'task' NOT NULL,
	"priority" varchar DEFAULT 'medium',
	"status" varchar DEFAULT 'pending',
	"due_date" timestamp,
	"due_time" varchar,
	"reminder_at" timestamp,
	"completed_at" timestamp,
	"is_recurring" boolean DEFAULT false,
	"recurrence_pattern" varchar,
	"recurrence_end_date" timestamp,
	"opportunity_id" varchar,
	"interaction_id" varchar,
	"notification_sent" boolean DEFAULT false,
	"tags" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "daily_picks" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" "pick_category" NOT NULL,
	"instrument_id" varchar(100),
	"instrument_name" varchar(255) NOT NULL,
	"isin" varchar(12),
	"symbol" varchar(50),
	"market" varchar(20),
	"reco_date" date NOT NULL,
	"reco_price" numeric(18, 4) NOT NULL,
	"target_price" numeric(18, 4) NOT NULL,
	"stoploss_price" numeric(18, 4) NOT NULL,
	"current_price" numeric(18, 4),
	"status" "pick_status" DEFAULT 'live' NOT NULL,
	"expiry_date" date NOT NULL,
	"status_updated_at" timestamp,
	"return_pct" numeric(8, 2),
	"days_held" integer,
	"rationale" text NOT NULL,
	"risk_level" varchar(20) DEFAULT 'medium',
	"suitable_for" text[],
	"time_horizon" varchar(20) DEFAULT 'medium_term',
	"confidence_score" integer DEFAULT 70,
	"sector_category" varchar(100),
	"key_metrics" jsonb,
	"generated_by" varchar(50) DEFAULT 'ai',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_reconciliation_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"product_scope" text DEFAULT 'all',
	"total_transactions" integer DEFAULT 0,
	"total_credits" numeric DEFAULT '0',
	"total_debits" numeric DEFAULT '0',
	"net_movement" numeric DEFAULT '0',
	"discrepancy_count" integer DEFAULT 0,
	"discrepancies" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'generated',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"signed_off_by" varchar,
	"signed_off_at" timestamp,
	"sign_off_notes" text,
	"pdf_report_path" text,
	"csv_export_path" text,
	"report_hash" varchar(64),
	"executed_by" varchar(100),
	"execution_duration_ms" integer,
	"retention_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_widget_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"widgets" jsonb DEFAULT '[{"id":"portfolio","enabled":true,"position":0,"size":"large"},{"id":"market_movers","enabled":true,"position":1,"size":"medium"},{"id":"quick_actions","enabled":true,"position":2,"size":"small"},{"id":"kyc_progress","enabled":true,"position":3,"size":"small"},{"id":"market_news","enabled":true,"position":4,"size":"medium"},{"id":"trending","enabled":false,"position":5,"size":"medium"},{"id":"goals_progress","enabled":false,"position":6,"size":"medium"}]'::jsonb NOT NULL,
	"layout_mode" varchar(20) DEFAULT 'grid',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "document_ai_reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"version_id" varchar NOT NULL,
	"review_type" varchar(50) DEFAULT 'compliance',
	"model_used" varchar(100),
	"overall_score" integer,
	"risk_score" integer,
	"compliance_score" integer,
	"findings" jsonb DEFAULT '[]'::jsonb,
	"missing_clauses" jsonb DEFAULT '[]'::jsonb,
	"risk_factors" jsonb DEFAULT '[]'::jsonb,
	"recommendations" jsonb DEFAULT '[]'::jsonb,
	"clause_mapping" jsonb DEFAULT '[]'::jsonb,
	"report_pdf_url" varchar(1000),
	"report_json_url" varchar(1000),
	"report_hash" varchar(128),
	"overall_confidence" integer,
	"explainability_notes" text,
	"limitations" text,
	"is_acknowledged" boolean DEFAULT false,
	"acknowledged_by" varchar,
	"acknowledged_at" timestamp,
	"acknowledgment_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processing_time" integer
);
--> statement-breakpoint
CREATE TABLE "document_audit_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"version_id" varchar,
	"event_type" varchar(100) NOT NULL,
	"event_category" varchar(50),
	"actor_id" varchar,
	"actor_role" varchar(50),
	"actor_name" varchar(255),
	"event_data" jsonb DEFAULT '{}'::jsonb,
	"previous_state" jsonb,
	"new_state" jsonb,
	"event_hash" varchar(128) NOT NULL,
	"previous_event_hash" varchar(128),
	"ip_address" varchar(50),
	"user_agent" text,
	"session_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_checklist_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" varchar NOT NULL,
	"sebi_clause_id" varchar NOT NULL,
	"clause_id" varchar,
	"status" varchar(20) DEFAULT 'pending',
	"is_compliant" boolean,
	"is_overridden" boolean DEFAULT false,
	"override_reason" text,
	"overridden_by" varchar,
	"overridden_at" timestamp,
	"ai_mapped_clause_ref" varchar,
	"ai_confidence" integer,
	"ai_notes" text,
	"reviewer_notes" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_checklist_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"version_id" varchar NOT NULL,
	"run_type" varchar(50) DEFAULT 'manual',
	"run_by" varchar,
	"run_by_role" varchar(50),
	"total_items" integer DEFAULT 0,
	"completed_items" integer DEFAULT 0,
	"pending_items" integer DEFAULT 0,
	"overridden_items" integer DEFAULT 0,
	"compliance_score" integer,
	"risk_score" integer,
	"status" varchar(20) DEFAULT 'in_progress',
	"is_approved" boolean DEFAULT false,
	"approved_by" varchar,
	"approved_at" timestamp,
	"checklist_snapshot" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "document_clauses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"version_id" varchar NOT NULL,
	"clause_number" varchar(50),
	"clause_title" varchar(255),
	"clause_category" varchar(100),
	"clause_text" text NOT NULL,
	"start_position" integer,
	"end_position" integer,
	"sebi_clause_id" varchar(50),
	"is_mandatory" boolean DEFAULT false,
	"is_compliant" boolean,
	"compliance_notes" text,
	"ai_confidence_score" integer,
	"ai_suggested_text" text,
	"ai_risk_level" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"version_id" varchar,
	"clause_id" varchar,
	"tracked_change_id" varchar,
	"parent_comment_id" varchar,
	"thread_id" varchar,
	"content" text NOT NULL,
	"selection_start" integer,
	"selection_end" integer,
	"selected_text" text,
	"author_id" varchar NOT NULL,
	"author_role" varchar(50) NOT NULL,
	"is_resolved" boolean DEFAULT false,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"is_ai_generated" boolean DEFAULT false,
	"ai_confidence" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_overrides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"checklist_item_id" varchar,
	"override_type" varchar(50) NOT NULL,
	"clause_code" varchar(50),
	"reason" text NOT NULL,
	"justification" text,
	"overridden_by" varchar NOT NULL,
	"overridden_by_role" varchar(50) NOT NULL,
	"requires_second_approval" boolean DEFAULT false,
	"second_approval_by" varchar,
	"second_approval_at" timestamp,
	"second_approval_notes" text,
	"risk_level" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_renewals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"renewal_type" varchar(50) DEFAULT 'expiry',
	"trigger_reason" text,
	"original_expiry_date" date,
	"reminder_t90_sent" boolean DEFAULT false,
	"reminder_t60_sent" boolean DEFAULT false,
	"reminder_t30_sent" boolean DEFAULT false,
	"ai_comparison_done" boolean DEFAULT false,
	"clause_drift" jsonb DEFAULT '[]'::jsonb,
	"risk_delta" jsonb DEFAULT '{}'::jsonb,
	"recommended_fixes" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(20) DEFAULT 'pending',
	"new_document_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "document_signatures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"version_id" varchar NOT NULL,
	"signer_id" varchar,
	"signer_name" varchar(255) NOT NULL,
	"signer_email" varchar(255),
	"signer_phone" varchar(20),
	"signer_role" varchar(50),
	"signer_designation" varchar(100),
	"signature_method" varchar(50) NOT NULL,
	"signature_provider" varchar(50),
	"status" varchar(20) DEFAULT 'pending',
	"signature_ref" varchar(255),
	"transaction_id" varchar(255),
	"verification_method" varchar(50),
	"verification_ref" varchar,
	"certificate_data" jsonb,
	"certificate_hash" varchar(128),
	"document_hash" varchar(128) NOT NULL,
	"signature_hash" varchar(128),
	"ip_address" varchar(50),
	"user_agent" text,
	"consent_captured" boolean DEFAULT false,
	"consent_text" text,
	"consent_timestamp" timestamp,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"signed_at" timestamp,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "document_tracked_changes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"version_id" varchar NOT NULL,
	"clause_id" varchar,
	"operation" "change_operation" NOT NULL,
	"old_text" text,
	"new_text" text,
	"start_position" integer,
	"end_position" integer,
	"suggested_by" varchar NOT NULL,
	"suggested_by_role" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"resolved_by" varchar,
	"resolved_by_role" varchar(50),
	"resolved_at" timestamp,
	"resolution_comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"version_number" integer NOT NULL,
	"version_label" varchar(100),
	"content" text,
	"content_type" varchar(50) DEFAULT 'text',
	"file_url" varchar(1000),
	"file_name" varchar(255),
	"file_size" integer,
	"file_mime_type" varchar(100),
	"content_hash" varchar(128) NOT NULL,
	"status_at_version" "document_status" NOT NULL,
	"change_summary" text,
	"changes_from_previous" jsonb DEFAULT '[]'::jsonb,
	"created_by" varchar,
	"created_by_role" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_locked" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "document_workflow_transitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"version_id" varchar,
	"from_status" "document_status" NOT NULL,
	"to_status" "document_status" NOT NULL,
	"performed_by" varchar NOT NULL,
	"performed_by_role" varchar(50) NOT NULL,
	"action" varchar(100) NOT NULL,
	"reason" text,
	"comments" text,
	"is_ai_override" boolean DEFAULT false,
	"ai_override_justification" text,
	"checklist_snapshot" jsonb,
	"checklist_complete" boolean DEFAULT false,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_number" varchar(50),
	"title" varchar(500) NOT NULL,
	"description" text,
	"entity_type" "document_entity_type" NOT NULL,
	"entity_id" varchar,
	"entity_name" varchar(255),
	"entity_pan" varchar(20),
	"agreement_type" "agreement_type" NOT NULL,
	"status" "document_status" DEFAULT 'draft' NOT NULL,
	"current_version_id" varchar,
	"version_count" integer DEFAULT 1,
	"parent_document_id" varchar,
	"effective_date" date,
	"expiry_date" date,
	"signed_date" date,
	"renewal_date" date,
	"risk_score" integer DEFAULT 0,
	"compliance_score" integer DEFAULT 0,
	"ai_review_score" integer,
	"assigned_to_user_id" varchar,
	"assigned_to_role" varchar(50),
	"tags" text[],
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"is_legacy" boolean DEFAULT false,
	"legacy_uploaded_at" timestamp,
	"legacy_declaration" text,
	"original_sign_date" date,
	"created_by" varchar,
	"created_by_role" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "documents_document_number_unique" UNIQUE("document_number")
);
--> statement-breakpoint
CREATE TABLE "dsa_commission_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"bank_code" varchar NOT NULL,
	"dsa_code" varchar NOT NULL,
	"sub_dsa_code" varchar,
	"agent_id" varchar,
	"disbursed_amount" numeric(15, 2) NOT NULL,
	"commission_rate" numeric(5, 4),
	"commission_amount" numeric(15, 2) NOT NULL,
	"platform_share" numeric(15, 2),
	"dsa_share" numeric(15, 2),
	"sub_dsa_share" numeric(15, 2),
	"payment_status" varchar DEFAULT 'pending',
	"payment_reference" varchar,
	"paid_at" timestamp,
	"gst_amount" numeric(15, 2),
	"invoice_number" varchar,
	"invoice_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dsa_loan_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_number" varchar,
	"applicant_type" varchar NOT NULL,
	"applicant_name" varchar NOT NULL,
	"applicant_email" varchar,
	"applicant_phone" varchar NOT NULL,
	"applicant_pan" varchar,
	"applicant_aadhaar" varchar,
	"date_of_birth" date,
	"gender" varchar,
	"address_line_1" varchar,
	"address_line_2" varchar,
	"city" varchar,
	"state" varchar,
	"pincode" varchar,
	"employment_type" varchar NOT NULL,
	"company_name" varchar,
	"designation" varchar,
	"work_experience" integer,
	"monthly_income" numeric(15, 2) NOT NULL,
	"annual_income" numeric(15, 2),
	"other_income" numeric(15, 2) DEFAULT '0',
	"loan_type" varchar NOT NULL,
	"requested_amount" numeric(15, 2) NOT NULL,
	"requested_tenure" integer NOT NULL,
	"loan_purpose" varchar,
	"existing_loans" integer DEFAULT 0,
	"existing_emi_amount" numeric(15, 2) DEFAULT '0',
	"credit_score" integer,
	"credit_bureau_provider" varchar,
	"credit_report_date" timestamp,
	"status" "dsa_loan_status" DEFAULT 'draft' NOT NULL,
	"current_stage" varchar DEFAULT 'application',
	"routing_strategy" "routing_strategy" DEFAULT 'parallel',
	"eligible_banks" text[] DEFAULT ARRAY[]::text[],
	"routed_banks" text[] DEFAULT ARRAY[]::text[],
	"routed_at" timestamp,
	"consent_timestamp" timestamp,
	"consent_ip_address" varchar,
	"consent_version" varchar,
	"disclosure_accepted" boolean DEFAULT false,
	"dsa_code" varchar,
	"agent_id" varchar,
	"sub_dsa_code" varchar,
	"user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"submitted_at" timestamp,
	"expires_at" timestamp,
	CONSTRAINT "dsa_loan_applications_application_number_unique" UNIQUE("application_number")
);
--> statement-breakpoint
CREATE TABLE "dsa_loan_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar,
	"action" varchar NOT NULL,
	"action_category" varchar NOT NULL,
	"actor_id" varchar,
	"actor_type" varchar,
	"actor_name" varchar,
	"actor_email" varchar,
	"previous_state" jsonb,
	"new_state" jsonb,
	"changed_fields" text[] DEFAULT ARRAY[]::text[],
	"ip_address" varchar,
	"user_agent" varchar,
	"session_id" varchar,
	"request_id" varchar,
	"bank_code" varchar,
	"notes" text,
	"retention_date" timestamp,
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dsa_loan_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"document_type" varchar NOT NULL,
	"document_name" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"file_size" integer,
	"mime_type" varchar,
	"storage_url" varchar NOT NULL,
	"encryption_key" varchar,
	"is_verified" boolean DEFAULT false,
	"verified_by" varchar,
	"verified_at" timestamp,
	"verification_method" varchar,
	"extracted_data" jsonb,
	"status" varchar DEFAULT 'pending',
	"rejection_reason" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "emergency_funds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"monthly_expenses" numeric(15, 2) NOT NULL,
	"required_emergency_fund" numeric(15, 2) NOT NULL,
	"current_emergency_fund" numeric(15, 2) DEFAULT '0',
	"emergency_fund_coverage" numeric(5, 2) DEFAULT '0',
	"fund_allocation" jsonb,
	"is_adequate" boolean DEFAULT false,
	"shortfall" numeric(15, 2) DEFAULT '0',
	"last_assessed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "emergency_funds_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "entity_compliance_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "document_entity_type" NOT NULL,
	"entity_id" varchar NOT NULL,
	"entity_name" varchar(255),
	"entity_pan" varchar(20),
	"overall_score" integer DEFAULT 0,
	"agreement_quality_score" integer DEFAULT 0,
	"renewal_hygiene_score" integer DEFAULT 0,
	"override_frequency_score" integer DEFAULT 0,
	"risk_exposure_score" integer DEFAULT 0,
	"total_documents" integer DEFAULT 0,
	"active_documents" integer DEFAULT 0,
	"expired_documents" integer DEFAULT 0,
	"pending_renewals" integer DEFAULT 0,
	"total_overrides" integer DEFAULT 0,
	"recent_overrides" integer DEFAULT 0,
	"has_high_risk_documents" boolean DEFAULT false,
	"has_overdue_renewals" boolean DEFAULT false,
	"has_compliance_issues" boolean DEFAULT false,
	"last_calculated_at" timestamp DEFAULT now(),
	"calculation_details" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "error_alert_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_type" varchar(20) NOT NULL,
	"webhook_config_id" varchar,
	"error_ids" text[],
	"error_code" varchar(100),
	"module" varchar(50),
	"occurrence_count" integer,
	"window_minutes" integer,
	"delivery_status" varchar(20) DEFAULT 'pending',
	"delivery_response" text,
	"delivery_attempts" integer DEFAULT 0,
	"triggered_at" timestamp DEFAULT now(),
	"delivered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "error_alert_threshold" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module" varchar(50),
	"error_code" varchar(100),
	"window_minutes" integer DEFAULT 5,
	"occurrence_threshold" integer DEFAULT 10,
	"is_enabled" boolean DEFAULT true,
	"auto_escalate_to_critical" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "error_ledger" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"error_code" varchar(100) NOT NULL,
	"severity" varchar(20) DEFAULT 'error' NOT NULL,
	"source" varchar(20) NOT NULL,
	"module" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"stack_hash" varchar(64),
	"stack_trace" text,
	"client_id" varchar,
	"agent_id" varchar,
	"pan_masked" varchar(20),
	"transaction_id" varchar(100),
	"request_id" varchar(100),
	"user_agent" text,
	"ip_address" varchar(45),
	"url" text,
	"http_method" varchar(10),
	"http_status" integer,
	"sentry_event_id" varchar(100),
	"status" varchar(20) DEFAULT 'open',
	"acknowledged_by" varchar,
	"acknowledged_at" timestamp,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"resolution_note" text,
	"occurrence_count" integer DEFAULT 1,
	"first_occurrence" timestamp DEFAULT now(),
	"last_occurrence" timestamp DEFAULT now(),
	"environment" varchar(20) DEFAULT 'production',
	"build_version" varchar(50),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "error_user_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"error_ledger_id" varchar,
	"error_id" varchar(100),
	"user_id" varchar,
	"user_email" varchar(255),
	"feedback_text" text NOT NULL,
	"expected_behavior" text,
	"steps_to_reproduce" text,
	"url" text,
	"user_agent" text,
	"status" varchar(20) DEFAULT 'new',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "error_webhook_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"provider" varchar(20) NOT NULL,
	"webhook_url" text NOT NULL,
	"is_enabled" boolean DEFAULT true,
	"environment" varchar(20) DEFAULT 'production',
	"trigger_on_critical" boolean DEFAULT true,
	"trigger_on_spike" boolean DEFAULT true,
	"trigger_modules" text[],
	"cooldown_minutes" integer DEFAULT 5,
	"last_triggered_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "esign_ai_analysis_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" varchar(100) NOT NULL,
	"workflow_id" integer,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"document_name" varchar(255),
	"document_type" varchar(50),
	"document_hash" varchar(128),
	"analysis_types" jsonb DEFAULT '["summary","corrections","missing_clauses","compliance"]'::jsonb,
	"ai_model" varchar(50) DEFAULT 'gemini-1.5-flash',
	"total_annotations" integer DEFAULT 0,
	"summary_count" integer DEFAULT 0,
	"correction_count" integer DEFAULT 0,
	"missing_clause_count" integer DEFAULT 0,
	"compliance_count" integer DEFAULT 0,
	"raw_ai_response" text,
	"processing_time_ms" integer,
	"token_count" integer,
	"requested_by_id" varchar(100),
	"requested_by_name" varchar(255),
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "esign_annotation_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"annotation_id" integer NOT NULL,
	"action" varchar(50) NOT NULL,
	"previous_status" varchar(30),
	"new_status" varchar(30),
	"actor_id" varchar(100),
	"actor_name" varchar(255),
	"actor_type" varchar(20),
	"details" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "esign_annotation_replies" (
	"id" serial PRIMARY KEY NOT NULL,
	"annotation_id" integer NOT NULL,
	"parent_reply_id" integer,
	"content" text NOT NULL,
	"author_id" varchar(100),
	"author_name" varchar(255),
	"author_type" varchar(20) NOT NULL,
	"author_email" varchar(255),
	"is_edited" boolean DEFAULT false,
	"edited_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "esign_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" varchar NOT NULL,
	"user_id" varchar,
	"action" varchar NOT NULL,
	"status" varchar NOT NULL,
	"details" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "esign_certificates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"transaction_id" varchar NOT NULL,
	"document_type" varchar NOT NULL,
	"document_name" text NOT NULL,
	"document_hash" varchar NOT NULL,
	"signed_document_url" text,
	"certificate_serial" varchar NOT NULL,
	"signer_name" text NOT NULL,
	"signer_aadhaar_masked" varchar NOT NULL,
	"signed_at" timestamp NOT NULL,
	"valid_from" timestamp NOT NULL,
	"valid_to" timestamp NOT NULL,
	"signature_algorithm" varchar DEFAULT 'SHA256withRSA',
	"status" varchar DEFAULT 'valid' NOT NULL,
	"revoked_at" timestamp,
	"revoked_reason" text,
	"provider" varchar DEFAULT 'authbridge',
	"dsc_certificate_class" varchar,
	"dsc_certificate_type" varchar,
	"dsc_issuer" text,
	"dsc_subject_dn" text,
	"dsc_certificate_fingerprint" varchar,
	"dsc_timestamp_authority" text,
	"dsc_timestamp" timestamp,
	"dsc_ocsp_status" varchar,
	"dsc_crl_status" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "esign_certificates_certificate_serial_unique" UNIQUE("certificate_serial")
);
--> statement-breakpoint
CREATE TABLE "esign_document_annotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" varchar(100) NOT NULL,
	"workflow_id" integer,
	"category" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"severity" varchar(20) DEFAULT 'info',
	"page_number" integer,
	"x_position" numeric(10, 4),
	"y_position" numeric(10, 4),
	"text_excerpt" text,
	"start_offset" integer,
	"end_offset" integer,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"accepted_by" varchar(100),
	"accepted_at" timestamp,
	"rejected_by" varchar(100),
	"rejected_at" timestamp,
	"rejection_reason" text,
	"created_by_type" varchar(20) DEFAULT 'ai' NOT NULL,
	"created_by_id" varchar(100),
	"created_by_name" varchar(255),
	"suggested_action" text,
	"suggested_replacement" text,
	"ai_model" varchar(50),
	"confidence" numeric(5, 4),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "esign_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"transaction_id" varchar NOT NULL,
	"document_type" varchar NOT NULL,
	"document_name" text NOT NULL,
	"document_hash" varchar NOT NULL,
	"document_url" text,
	"signer_name" text NOT NULL,
	"aadhaar_masked" varchar NOT NULL,
	"status" varchar DEFAULT 'initiated' NOT NULL,
	"error_message" text,
	"otp_sent_at" timestamp,
	"expires_at" timestamp,
	"completed_at" timestamp,
	"certificate_id" varchar,
	"api_response" jsonb,
	"provider" varchar DEFAULT 'authbridge',
	"dsc_token_info" jsonb,
	"dsc_certificate_fingerprint" varchar,
	"dsc_signing_method" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "esign_requests_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "exchange_filing_sources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" varchar NOT NULL,
	"source_name" varchar NOT NULL,
	"base_url" varchar NOT NULL,
	"api_endpoint" varchar,
	"supported_document_types" jsonb DEFAULT '["PDF","XBRL","XLS"]'::jsonb,
	"active" boolean DEFAULT true,
	"rate_limit_per_minute" integer DEFAULT 60,
	"last_fetch_at" timestamp,
	"fetch_success_count" integer DEFAULT 0,
	"fetch_failure_count" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_filing_sources_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "exchange_filings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fintekpro_company_id" varchar,
	"exchange" varchar NOT NULL,
	"symbol" varchar,
	"company_name" varchar NOT NULL,
	"filing_type" varchar NOT NULL,
	"financial_type" varchar DEFAULT 'STANDALONE',
	"document_url" varchar NOT NULL,
	"document_hash" varchar,
	"document_source" varchar DEFAULT 'generated',
	"original_file_format" varchar,
	"uploaded_by_user_id" varchar,
	"uploaded_at" timestamp,
	"filing_date" date NOT NULL,
	"period_start" date,
	"period_end" date,
	"financial_year" varchar,
	"quarter" varchar,
	"document_type" varchar,
	"file_size_bytes" integer,
	"is_processed" boolean DEFAULT false,
	"processing_status" varchar DEFAULT 'pending',
	"processing_error" text,
	"extraction_confidence" numeric,
	"ingested_at" timestamp DEFAULT now(),
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_financial_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"filing_id" varchar,
	"exchange" varchar NOT NULL,
	"metric" varchar NOT NULL,
	"metric_value" numeric,
	"metric_value_text" text,
	"previous_value" numeric,
	"financial_year" varchar NOT NULL,
	"period" varchar,
	"period_end" date,
	"currency" varchar DEFAULT 'INR',
	"document_url" varchar,
	"document_hash" varchar,
	"document_source" varchar DEFAULT 'generated',
	"original_file_format" varchar,
	"uploaded_by_user_id" varchar,
	"uploaded_at" timestamp,
	"extraction_method" varchar NOT NULL,
	"extraction_confidence" numeric,
	"extracted_by" varchar NOT NULL,
	"extraction_source" varchar,
	"is_manual_override" boolean DEFAULT false,
	"override_reason" text,
	"override_by" varchar,
	"override_at" timestamp,
	"is_approved" boolean DEFAULT false,
	"approved_by" varchar,
	"approved_at" timestamp,
	"hash_previous" varchar,
	"hash_current" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "explanation_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"what_is_happening" text NOT NULL,
	"why_it_matters" text NOT NULL,
	"client_impact" text,
	"risks" text,
	"what_is_not_claimed" text,
	"technical_version" text,
	"simple_version" text,
	"applicable_products" jsonb DEFAULT '[]'::jsonb,
	"applicable_scenarios" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_by" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "external_holdings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"symbol" text NOT NULL,
	"name" text,
	"isin" text,
	"asset_type" text DEFAULT 'Equity',
	"quantity" numeric(15, 4) NOT NULL,
	"avg_price" numeric(15, 4) DEFAULT '0',
	"current_value" numeric(15, 2) DEFAULT '0',
	"source" text NOT NULL,
	"depository" text,
	"dp_id" text,
	"client_id" text,
	"consent_id" text,
	"last_synced_at" timestamp DEFAULT now(),
	"cob_status" text DEFAULT 'none',
	"cob_initiated_at" timestamp,
	"cob_initiated_by" varchar,
	"cob_target_broker" text,
	"cob_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "external_remittance_proofs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar(100) NOT NULL,
	"product_type" text NOT NULL,
	"product_id" varchar(100) NOT NULL,
	"product_name" text NOT NULL,
	"user_id" varchar,
	"remittance_type" text NOT NULL,
	"expected_amount" numeric NOT NULL,
	"currency" varchar(10) DEFAULT 'INR',
	"document_path" text,
	"document_hash" varchar(64),
	"hash_algorithm" varchar(20) DEFAULT 'sha256',
	"original_file_name" text,
	"file_size" integer,
	"mime_type" varchar(100),
	"beneficiary_name" text,
	"bank_name" text,
	"account_number" text,
	"ifsc_code" varchar(11),
	"utr_number" varchar(50),
	"transaction_date" date,
	"status" text DEFAULT 'pending_upload',
	"verified_by" varchar,
	"verified_at" timestamp,
	"rejection_reason" text,
	"reviewer_notes" text,
	"capital_call_reference" varchar(100),
	"subscription_agreement_id" varchar(100),
	"uploaded_at" timestamp,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"retention_expires_at" timestamp,
	"ip_address" varchar(45),
	"user_agent" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "fee_mode_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"old_mode" varchar(30),
	"new_mode" varchar(30) NOT NULL,
	"changed_by" varchar(20) NOT NULL,
	"changed_by_id" varchar,
	"ip_address" varchar(45),
	"user_agent" text,
	"change_reason" text,
	"consent_captured" boolean DEFAULT false NOT NULL,
	"disclaimer_shown" boolean DEFAULT false NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"checksum_hash" varchar(64)
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
	"zoho_synced_at" timestamp,
	"zoho_invoice_id" varchar,
	"zoho_sync_status" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "filing_records_acknowledgment_number_unique" UNIQUE("acknowledgment_number")
);
--> statement-breakpoint
CREATE TABLE "financial_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"metric" varchar NOT NULL,
	"metric_value" numeric(20, 2),
	"metric_value_text" text,
	"previous_value" numeric(20, 2),
	"financial_year" varchar NOT NULL,
	"period" varchar,
	"currency" varchar DEFAULT 'INR',
	"source" varchar NOT NULL,
	"source_response_id" varchar,
	"probe42_reference" varchar,
	"confidence_score" numeric(3, 2),
	"data_quality_flags" jsonb DEFAULT '[]'::jsonb,
	"used_in" varchar,
	"used_at" timestamp,
	"used_by_user_id" varchar,
	"action_type" varchar NOT NULL,
	"action_by" varchar,
	"action_by_user_id" varchar,
	"action_reason" text,
	"hash_previous" varchar,
	"hash_current" varchar,
	"retrieved_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_goals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"goal_type" varchar NOT NULL,
	"category" varchar NOT NULL,
	"icon" varchar DEFAULT 'target',
	"color" varchar DEFAULT '#3b82f6',
	"target_amount" numeric(15, 2) NOT NULL,
	"current_amount" numeric(15, 2) DEFAULT '0',
	"monthly_contribution" numeric(10, 2) DEFAULT '0',
	"target_date" timestamp NOT NULL,
	"start_date" timestamp DEFAULT now(),
	"inflation_rate" numeric(5, 2) DEFAULT '6',
	"inflation_adjusted_target" numeric(15, 2),
	"suggested_sip_amount" numeric(10, 2),
	"suggested_lumpsum" numeric(15, 2),
	"expected_return_rate" numeric(5, 2) DEFAULT '12',
	"suggested_allocation" jsonb,
	"risk_profile" varchar NOT NULL,
	"priority" varchar DEFAULT 'medium',
	"recommended_investments" text[],
	"current_progress" numeric(5, 2) DEFAULT '0',
	"projected_value" numeric(15, 2),
	"on_track_status" varchar DEFAULT 'on_track',
	"is_active" boolean DEFAULT true,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"tags" text[],
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_instruments_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instrument_type" varchar NOT NULL,
	"symbol" varchar NOT NULL,
	"isin" varchar,
	"name" text NOT NULL,
	"exchange" varchar,
	"currency" varchar DEFAULT 'INR',
	"country" varchar DEFAULT 'IN',
	"current_price" numeric(15, 4),
	"previous_close" numeric(15, 4),
	"day_change" numeric(15, 4),
	"day_change_percent" numeric(10, 4),
	"day_high" numeric(15, 4),
	"day_low" numeric(15, 4),
	"open_price" numeric(15, 4),
	"volume" bigint,
	"nav" numeric(15, 4),
	"nav_date" date,
	"return_1d" numeric(10, 4),
	"return_1w" numeric(10, 4),
	"return_1m" numeric(10, 4),
	"return_3m" numeric(10, 4),
	"return_6m" numeric(10, 4),
	"return_1y" numeric(10, 4),
	"return_3y" numeric(10, 4),
	"return_5y" numeric(10, 4),
	"yield_percent" numeric(10, 4),
	"coupon_rate" numeric(10, 4),
	"maturity_date" date,
	"market_cap" numeric(20, 2),
	"pe_ratio" numeric(10, 2),
	"dividend_yield" numeric(10, 4),
	"category" varchar,
	"sector" varchar,
	"sub_sector" varchar,
	"amc" varchar,
	"fund_manager" varchar,
	"expense_ratio" numeric(6, 4),
	"aum" numeric(20, 2),
	"risk_level" varchar,
	"volatility" numeric(10, 4),
	"sharpe_ratio" numeric(10, 4),
	"beta" numeric(10, 4),
	"data_source" varchar NOT NULL,
	"secondary_source" varchar,
	"confidence_score" integer DEFAULT 100,
	"is_verified" boolean DEFAULT false,
	"verification_notes" text,
	"price_updated_at" timestamp,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_obligations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"obligation_type" varchar NOT NULL,
	"institution_name" varchar,
	"account_number" varchar,
	"monthly_amount" numeric(15, 2) NOT NULL,
	"total_outstanding" numeric(15, 2),
	"interest_rate" numeric(5, 2),
	"start_date" date,
	"end_date" date,
	"remaining_tenure" integer,
	"priority" varchar DEFAULT 'essential' NOT NULL,
	"is_fixed" boolean DEFAULT true,
	"cibil_reported" boolean DEFAULT false,
	"cibil_account_type" varchar,
	"payment_history" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fixed_income_agent_commissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"agent_id" varchar,
	"partner_id" varchar,
	"client_id" varchar NOT NULL,
	"product_type" varchar NOT NULL,
	"isin" varchar,
	"product_name" text NOT NULL,
	"transaction_type" varchar NOT NULL,
	"transaction_amount" numeric(15, 2) NOT NULL,
	"transaction_date" date NOT NULL,
	"commission_type" varchar NOT NULL,
	"commission_rate" numeric(8, 4),
	"gross_commission" numeric(15, 2) NOT NULL,
	"tds_deducted" numeric(15, 2) DEFAULT '0',
	"tds_rate" numeric(5, 2) DEFAULT '5',
	"gst_on_commission" numeric(15, 2) DEFAULT '0',
	"gst_rate" numeric(5, 2) DEFAULT '18',
	"other_deductions" numeric(15, 2) DEFAULT '0',
	"net_commission" numeric(15, 2) NOT NULL,
	"agent_share" numeric(15, 2),
	"master_agent_share" numeric(15, 2),
	"platform_share" numeric(15, 2),
	"settlement_status" varchar DEFAULT 'pending',
	"settlement_date" date,
	"settlement_reference" varchar,
	"settlement_batch_id" varchar,
	"clawback_eligible" boolean DEFAULT true,
	"clawback_period_days" integer DEFAULT 365,
	"clawback_expires_at" date,
	"clawback_triggered" boolean DEFAULT false,
	"clawback_amount" numeric(15, 2),
	"clawback_reason" text,
	"approval_status" varchar DEFAULT 'pending',
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"calculation_details" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fixed_income_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"session_id" varchar,
	"event_type" varchar NOT NULL,
	"event_category" varchar NOT NULL,
	"entity_type" varchar,
	"entity_id" varchar,
	"isin" varchar,
	"bond_name" text,
	"event_data" jsonb DEFAULT '{}'::jsonb,
	"previous_state" jsonb,
	"new_state" jsonb,
	"amount" numeric(15, 2),
	"currency" varchar DEFAULT 'INR',
	"event_result" varchar NOT NULL,
	"error_code" varchar,
	"error_message" text,
	"event_source" varchar NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"device_id" varchar,
	"exchange_order_id" varchar,
	"exchange_transaction_id" varchar,
	"payment_gateway_ref" varchar,
	"regulatory_reporting_required" boolean DEFAULT false,
	"regulatory_report_id" varchar,
	"retention_expires_at" timestamp NOT NULL,
	"event_timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fixed_income_feed_ingestion_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feed_source" varchar NOT NULL,
	"feed_type" varchar NOT NULL,
	"instrument_type" varchar NOT NULL,
	"ingestion_start_time" timestamp NOT NULL,
	"ingestion_end_time" timestamp,
	"records_received" integer DEFAULT 0,
	"records_inserted" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"records_skipped" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"ingestion_status" varchar DEFAULT 'in_progress',
	"error_details" jsonb DEFAULT '[]'::jsonb,
	"failed_records" jsonb DEFAULT '[]'::jsonb,
	"data_quality_score" numeric(5, 2),
	"duplicates_found" integer DEFAULT 0,
	"validation_errors" integer DEFAULT 0,
	"raw_response_path" text,
	"response_checksum" varchar,
	"triggered_by" varchar DEFAULT 'system',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fixed_income_notification_prefs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"email_enabled" boolean DEFAULT true,
	"sms_enabled" boolean DEFAULT true,
	"push_enabled" boolean DEFAULT true,
	"whatsapp_enabled" boolean DEFAULT false,
	"order_confirmation_alert" boolean DEFAULT true,
	"order_execution_alert" boolean DEFAULT true,
	"payment_reminder_alert" boolean DEFAULT true,
	"settlement_alert" boolean DEFAULT true,
	"coupon_credit_alert" boolean DEFAULT true,
	"coupon_due_reminder_days" integer DEFAULT 3,
	"maturity_alert_enabled" boolean DEFAULT true,
	"maturity_reminder_days" jsonb DEFAULT '[90,60,30,7]'::jsonb,
	"put_call_option_alert" boolean DEFAULT true,
	"put_call_reminder_days" integer DEFAULT 30,
	"rating_change_alert" boolean DEFAULT true,
	"rating_downgrade_alert" boolean DEFAULT true,
	"new_ncd_issue_alert" boolean DEFAULT true,
	"new_sgb_issue_alert" boolean DEFAULT true,
	"new_gsec_auction_alert" boolean DEFAULT false,
	"price_alert_enabled" boolean DEFAULT false,
	"default_price_threshold_percent" numeric(5, 2) DEFAULT '5',
	"yield_alert_enabled" boolean DEFAULT false,
	"default_yield_threshold_bps" integer DEFAULT 25,
	"portfolio_value_alert" boolean DEFAULT false,
	"portfolio_value_threshold_percent" numeric(5, 2),
	"weekly_market_digest" boolean DEFAULT true,
	"research_reports_alert" boolean DEFAULT false,
	"regulatory_update_alert" boolean DEFAULT true,
	"tax_deadline_alert" boolean DEFAULT true,
	"quiet_hours_enabled" boolean DEFAULT false,
	"quiet_hours_start" varchar,
	"quiet_hours_end" varchar,
	"quiet_hours_timezone" varchar DEFAULT 'Asia/Kolkata',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "fixed_income_notification_prefs_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "fixed_income_order_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"payment_type" varchar NOT NULL,
	"payment_method" varchar NOT NULL,
	"order_amount" numeric(15, 2) NOT NULL,
	"payment_amount" numeric(15, 2) NOT NULL,
	"convenience_fee" numeric(10, 2) DEFAULT '0',
	"gst_on_fee" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(15, 2) NOT NULL,
	"payment_gateway" varchar NOT NULL,
	"gateway_order_id" varchar,
	"gateway_payment_id" varchar,
	"gateway_transaction_id" varchar,
	"payment_link_url" text,
	"payment_link_expires_at" timestamp,
	"payment_status" varchar DEFAULT 'pending',
	"payment_initiated_at" timestamp,
	"payment_completed_at" timestamp,
	"payer_bank_name" varchar,
	"payer_account_number" varchar,
	"payer_vpa" varchar,
	"gateway_response" jsonb DEFAULT '{}'::jsonb,
	"gateway_signature" varchar,
	"callback_received_at" timestamp,
	"asba_bank_name" varchar,
	"asba_account_number" varchar,
	"asba_blocked_amount" numeric(15, 2),
	"asba_release_date" date,
	"refund_status" varchar,
	"refund_amount" numeric(15, 2),
	"refund_reason" text,
	"refund_reference" varchar,
	"refund_completed_at" timestamp,
	"reconciliation_status" varchar DEFAULT 'pending',
	"bank_reconciliation_ref" varchar,
	"retry_count" integer DEFAULT 0,
	"last_retry_at" timestamp,
	"error_code" varchar,
	"error_message" text,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "fixed_income_order_payments_gateway_order_id_unique" UNIQUE("gateway_order_id")
);
--> statement-breakpoint
CREATE TABLE "fixed_income_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"report_type" varchar NOT NULL,
	"report_name" text NOT NULL,
	"report_description" text,
	"report_period_start" date,
	"report_period_end" date,
	"instrument_types" jsonb DEFAULT '[]'::jsonb,
	"report_filters" jsonb DEFAULT '{}'::jsonb,
	"report_format" varchar NOT NULL,
	"file_url" text,
	"file_path" text,
	"file_size" integer,
	"file_checksum" varchar,
	"encryption_key_id" varchar,
	"generation_status" varchar DEFAULT 'pending',
	"generation_started_at" timestamp,
	"generation_completed_at" timestamp,
	"generation_error" text,
	"download_count" integer DEFAULT 0,
	"last_downloaded_at" timestamp,
	"expires_at" timestamp,
	"requested_by" varchar,
	"request_ip_address" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fixed_income_settlements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"settlement_type" varchar NOT NULL,
	"settlement_cycle" varchar NOT NULL,
	"isin" varchar NOT NULL,
	"security_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"settlement_value" numeric(15, 2) NOT NULL,
	"trade_date" date NOT NULL,
	"expected_settlement_date" date NOT NULL,
	"actual_settlement_date" date,
	"depository" varchar NOT NULL,
	"dp_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"demat_account_number" varchar NOT NULL,
	"settlement_status" varchar DEFAULT 'pending',
	"depository_transaction_id" varchar,
	"depository_instruction_id" varchar,
	"depository_ref_number" varchar,
	"clearing_corporation" varchar,
	"clearing_number" varchar,
	"clearing_reference" varchar,
	"payin_status" varchar,
	"payout_status" varchar,
	"obligation_id" varchar,
	"obligation_type" varchar,
	"counterparty_dp_id" varchar,
	"counterparty_client_id" varchar,
	"corporate_actions_pending" boolean DEFAULT false,
	"corporate_actions_details" jsonb DEFAULT '[]'::jsonb,
	"settlement_failure_reason" text,
	"retry_attempts" integer DEFAULT 0,
	"last_retry_at" timestamp,
	"status_history" jsonb DEFAULT '[]'::jsonb,
	"encrypted_pan" varchar,
	"pan_encryption_key_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fixed_income_status_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isin" varchar NOT NULL,
	"previous_status" varchar(16),
	"new_status" varchar(16) NOT NULL,
	"change_reason" text NOT NULL,
	"evaluation_gates" jsonb DEFAULT '{}'::jsonb,
	"triggered_by" varchar(50) DEFAULT 'daily_refresh',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "form_15_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"user_role" varchar NOT NULL,
	"user_email" varchar,
	"action_type" varchar NOT NULL,
	"action_description" text NOT NULL,
	"field_changed" varchar,
	"previous_value" text,
	"new_value" text,
	"ip_address" varchar,
	"user_agent" text,
	"dsc_serial_number" varchar,
	"icai_membership_number" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_15_cases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_number" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"ca_id" varchar,
	"agent_id" varchar,
	"created_by" varchar NOT NULL,
	"created_by_role" varchar NOT NULL,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"sub_status" varchar,
	"client_pan" varchar NOT NULL,
	"client_name" varchar NOT NULL,
	"client_residential_status" varchar NOT NULL,
	"client_address" text,
	"client_email" varchar,
	"client_phone" varchar,
	"remittance_amount" numeric(18, 2) NOT NULL,
	"remittance_currency" varchar DEFAULT 'USD' NOT NULL,
	"remittance_amount_inr" numeric(18, 2),
	"exchange_rate" numeric(12, 6),
	"beneficiary_name" varchar NOT NULL,
	"beneficiary_country" varchar NOT NULL,
	"beneficiary_address" text,
	"beneficiary_bank_name" varchar,
	"beneficiary_account_number" varchar,
	"beneficiary_swift_code" varchar,
	"rbi_purpose_code" varchar NOT NULL,
	"rbi_purpose_description" text,
	"nature_of_payment" varchar NOT NULL,
	"section_under_which_tax_deducted" varchar,
	"dtaa_applicable" boolean DEFAULT false,
	"dtaa_country" varchar,
	"dtaa_article" varchar,
	"dtaa_rate" numeric(5, 2),
	"dtaa_analysis" text,
	"trc_available" boolean DEFAULT false,
	"form_10f_available" boolean DEFAULT false,
	"no_pe_declaration" boolean DEFAULT false,
	"form_15ca_required" boolean DEFAULT true,
	"form_15ca_part" varchar,
	"form_15cb_required" boolean DEFAULT false,
	"rule_37bb_justification" text,
	"ca_override_reason" text,
	"gross_amount" numeric(18, 2),
	"taxable_amount" numeric(18, 2),
	"tds_rate" numeric(5, 2),
	"tds_amount" numeric(18, 2),
	"surcharge" numeric(18, 2),
	"cess" numeric(18, 2),
	"total_tax_deducted" numeric(18, 2),
	"net_remittance" numeric(18, 2),
	"agent_remarks" text,
	"agent_prepared_at" timestamp,
	"agent_submitted_for_review" boolean DEFAULT false,
	"agent_submitted_at" timestamp,
	"ca_review_started_at" timestamp,
	"ca_review_completed_at" timestamp,
	"ca_remarks" text,
	"ca_sent_back_to_agent" boolean DEFAULT false,
	"ca_sent_back_reason" text,
	"ca_documents_reviewed" boolean DEFAULT false,
	"ca_dtaa_verified" boolean DEFAULT false,
	"ca_tax_computation_confirmed" boolean DEFAULT false,
	"ca_legal_responsibility_accepted" boolean DEFAULT false,
	"ca_approval_timestamp" timestamp,
	"form_15cb_number" varchar,
	"form_15cb_date" timestamp,
	"form_15cb_dsc_serial_number" varchar,
	"form_15cb_signed_at" timestamp,
	"form_15cb_signed_by_icai" varchar,
	"form_15cb_pdf_url" text,
	"form_15cb_locked" boolean DEFAULT false,
	"form_15ca_part_a" jsonb,
	"form_15ca_part_b" jsonb,
	"form_15ca_part_c" jsonb,
	"form_15ca_part_d" jsonb,
	"form_15ca_acknowledgement_number" varchar,
	"form_15ca_filed_at" timestamp,
	"form_15ca_pdf_url" text,
	"form_15ca_everified" boolean DEFAULT false,
	"form_15ca_everified_at" timestamp,
	"form_15ca_everified_by" varchar,
	"compliance_pack_generated" boolean DEFAULT false,
	"compliance_pack_url" text,
	"compliance_pack_generated_at" timestamp,
	"compliance_pack_shared_link" varchar,
	"compliance_pack_shared_link_expiry" timestamp,
	"internal_notes" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "form_15_cases_case_number_unique" UNIQUE("case_number")
);
--> statement-breakpoint
CREATE TABLE "form_15_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"document_type" varchar NOT NULL,
	"document_name" varchar NOT NULL,
	"document_url" text,
	"file_size" integer,
	"mime_type" varchar,
	"version" integer DEFAULT 1,
	"is_mandatory" boolean DEFAULT false,
	"status" varchar DEFAULT 'uploaded',
	"verified_by" varchar,
	"verified_at" timestamp,
	"rejection_reason" text,
	"is_locked_after_signing" boolean DEFAULT false,
	"locked_at" timestamp,
	"uploaded_by" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "fund_financial_ratios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_code" varchar NOT NULL,
	"scheme_name" text,
	"fund_house" varchar,
	"category" varchar,
	"portfolio_pe" numeric(10, 2),
	"portfolio_pb" numeric(10, 2),
	"category_avg_pe" numeric(10, 2),
	"category_avg_pb" numeric(10, 2),
	"pe_vs_category" numeric(8, 2),
	"avg_roe" numeric(8, 2),
	"avg_roce" numeric(8, 2),
	"sharpe_ratio" numeric(8, 4),
	"sortino_ratio" numeric(8, 4),
	"alpha" numeric(8, 4),
	"beta" numeric(8, 4),
	"standard_deviation" numeric(8, 4),
	"upside_capture_ratio" numeric(8, 2),
	"downside_capture_ratio" numeric(8, 2),
	"cagr_1y" numeric(8, 4),
	"cagr_3y" numeric(8, 4),
	"cagr_5y" numeric(8, 4),
	"category_cagr_1y" numeric(8, 4),
	"category_cagr_3y" numeric(8, 4),
	"cagr_vs_category" numeric(8, 2),
	"current_aum" numeric(18, 2),
	"aum_6_months_ago" numeric(18, 2),
	"aum_1_year_ago" numeric(18, 2),
	"aum_growth_yoy" numeric(8, 2),
	"expense_ratio" numeric(5, 2),
	"exit_load_percent" numeric(5, 2),
	"exit_load_days" integer,
	"exit_load_description" text,
	"purchase_allowed" boolean DEFAULT true,
	"sip_allowed" boolean DEFAULT true,
	"redemption_allowed" boolean DEFAULT true,
	"scheme_status" varchar DEFAULT 'active',
	"fintekpro_rating" integer,
	"category_percentile" numeric(5, 2),
	"ai_signal" varchar DEFAULT 'hold',
	"ai_confidence" numeric(5, 2),
	"ai_rationale" text,
	"current_nav" numeric(12, 4),
	"nav_date" date,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "fund_financial_ratios_scheme_code_unique" UNIQUE("scheme_code")
);
--> statement-breakpoint
CREATE TABLE "fund_managers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"designation" text,
	"fund_house" text,
	"experience_years" integer,
	"qualifications" text,
	"certifications" text[],
	"total_aum_managed" numeric(20, 2),
	"funds_managed" integer,
	"avg_alpha" numeric(8, 4),
	"consistency_score" numeric(5, 2),
	"bio" text,
	"photo_url" text,
	"linkedin_url" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fund_performance_monthwise" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_type" text NOT NULL,
	"fund_id" varchar NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"nav" numeric(15, 4),
	"return_percent" numeric(8, 4),
	"benchmark_return" numeric(8, 4),
	"alpha" numeric(8, 4),
	"aum" numeric(20, 2),
	"volatility" numeric(8, 4),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fund_performance_rolling" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_type" text NOT NULL,
	"fund_id" varchar NOT NULL,
	"as_of_date" date NOT NULL,
	"return_1m" numeric(8, 4),
	"return_3m" numeric(8, 4),
	"return_6m" numeric(8, 4),
	"return_1y" numeric(8, 4),
	"return_2y" numeric(8, 4),
	"return_3y" numeric(8, 4),
	"return_5y" numeric(8, 4),
	"return_si" numeric(8, 4),
	"volatility" numeric(8, 4),
	"max_drawdown" numeric(8, 4),
	"sharpe_ratio" numeric(8, 4),
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "gift_city_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100) NOT NULL,
	"subcategory" varchar(100),
	"flow_direction" varchar(20) DEFAULT 'inbound' NOT NULL,
	"regulatory_framework" varchar(100),
	"investor_type" varchar(100),
	"lrs_applicable" boolean DEFAULT false NOT NULL,
	"lrs_category" varchar(100),
	"minimum_investment" numeric(20, 2),
	"currency" varchar(20) DEFAULT 'USD',
	"expected_returns" varchar(50),
	"risk_level" varchar(50),
	"provider" varchar(255),
	"features" text[],
	"regulatory_benefits" text[],
	"eligibility" text[],
	"compliance_requirements" text[],
	"tax_implications" text,
	"is_published" boolean DEFAULT true NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"is_limited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_advisory_acknowledgments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"market_code" varchar(10) NOT NULL,
	"acknowledgment_type" varchar(50) NOT NULL,
	"disclaimer_version" varchar(20) NOT NULL,
	"disclaimer_text" text NOT NULL,
	"acknowledged_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"session_id" varchar(100),
	"expires_at" timestamp,
	"is_revoked" boolean DEFAULT false,
	"revoked_at" timestamp,
	"revoked_reason" text
);
--> statement-breakpoint
CREATE TABLE "global_advisory_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"session_id" varchar(100),
	"event_type" varchar(50) NOT NULL,
	"event_sub_type" varchar(50),
	"market_code" varchar(10),
	"product_category" varchar(50),
	"event_data" jsonb,
	"ai_rationale" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"request_path" varchar(500),
	"advisory_classification" varchar(20),
	"disclaimer_shown" boolean DEFAULT false,
	"event_timestamp" timestamp DEFAULT now() NOT NULL,
	"checksum_hash" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "global_advisory_recommendations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"instrument_id" varchar,
	"symbol" varchar(20) NOT NULL,
	"instrument_name" varchar(255),
	"asset_class" varchar(30) NOT NULL,
	"market" varchar(10) NOT NULL,
	"exchange" varchar(20),
	"currency" varchar(3) NOT NULL,
	"recommendation" varchar(20) NOT NULL,
	"fintekpro_rating" numeric,
	"confidence_score" numeric,
	"risk_score" numeric,
	"current_price" numeric,
	"current_price_inr" numeric,
	"target_price" numeric,
	"target_price_inr" numeric,
	"stop_loss" numeric,
	"expected_return" numeric,
	"time_horizon" varchar(30),
	"time_horizon_days" integer,
	"fundamentals" jsonb,
	"technicals" jsonb,
	"sector_analysis" text,
	"rationale" text,
	"key_factors" jsonb,
	"risk_factors" jsonb,
	"tax_implications" jsonb,
	"lrs_considerations" text,
	"suitability_score" numeric,
	"alternative_options" jsonb,
	"is_personalized" boolean DEFAULT false,
	"generated_by" varchar(50) DEFAULT 'ai',
	"expires_at" timestamp,
	"view_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_instruments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"asset_class" varchar(30) NOT NULL,
	"exchange" varchar(20) NOT NULL,
	"market" varchar(10) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"isin" varchar(12),
	"cusip" varchar(9),
	"sedol" varchar(7),
	"sector" varchar(100),
	"industry" varchar(100),
	"market_cap" numeric,
	"market_cap_category" varchar(20),
	"dividend_yield" numeric,
	"expense_ratio" numeric,
	"aum" numeric,
	"maturity_date" date,
	"coupon_rate" numeric,
	"credit_rating" varchar(10),
	"yield_to_maturity" numeric,
	"domicile" varchar(50),
	"is_active" boolean DEFAULT true,
	"lrs_eligible" boolean DEFAULT true,
	"fatca_compliant" boolean DEFAULT true,
	"last_price" numeric,
	"last_price_inr" numeric,
	"price_change_percent" numeric,
	"week_52_high" numeric,
	"week_52_low" numeric,
	"avg_volume" numeric,
	"beta" numeric,
	"pe_ratio" numeric,
	"pb_ratio" numeric,
	"eps_growth" numeric,
	"returns_1m" numeric,
	"returns_3m" numeric,
	"returns_1y" numeric,
	"returns_3y" numeric,
	"returns_5y" numeric,
	"data_source" varchar(50),
	"api_symbol" varchar(30),
	"is_tradeable" boolean DEFAULT false,
	"lot_size" integer DEFAULT 1,
	"trading_api_provider" varchar(30),
	"bid_price" numeric,
	"ask_price" numeric,
	"trading_hours" varchar(100),
	"api_config" jsonb DEFAULT '{}'::jsonb,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_investment_admin_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enable_platform_only_mode" boolean DEFAULT true NOT NULL,
	"allow_client_self_selection" boolean DEFAULT true NOT NULL,
	"default_fee_mode" varchar(30) DEFAULT 'ADVISORY_PLATFORM',
	"advisory_fee_bps" integer DEFAULT 25,
	"platform_fee_bps" integer DEFAULT 10,
	"advisory_fee_cap_inr" numeric(15, 2),
	"platform_fee_cap_inr" numeric(15, 2),
	"segment_overrides" jsonb DEFAULT '[]'::jsonb,
	"policy_version" integer DEFAULT 1 NOT NULL,
	"policy_updated_at" timestamp DEFAULT now(),
	"policy_updated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_investment_client_fee_mode" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"fee_mode" varchar(30) NOT NULL,
	"fee_mode_selected_at" timestamp NOT NULL,
	"fee_mode_consent_ip" varchar(45),
	"disclaimer_acknowledged" boolean DEFAULT false NOT NULL,
	"disclaimer_acknowledged_at" timestamp,
	"last_modified_by" varchar(20),
	"last_modified_by_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "global_investment_client_fee_mode_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "global_portfolio_positions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"instrument_id" varchar,
	"symbol" varchar(20) NOT NULL,
	"asset_class" varchar(30) NOT NULL,
	"quantity" numeric NOT NULL,
	"avg_cost_basis" numeric NOT NULL,
	"avg_cost_basis_inr" numeric NOT NULL,
	"current_value" numeric,
	"current_value_inr" numeric,
	"unrealized_gain" numeric,
	"unrealized_gain_inr" numeric,
	"unrealized_gain_percent" numeric,
	"currency" varchar(3) NOT NULL,
	"market" varchar(10) NOT NULL,
	"purchase_date" date,
	"target_allocation" numeric,
	"actual_allocation" numeric,
	"drift_percent" numeric,
	"lrs_remittance_id" varchar,
	"broker_account" varchar(100),
	"broker_name" varchar(100),
	"notes" text,
	"is_active" boolean DEFAULT true,
	"last_rebalanced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_investment_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"investment_type" varchar NOT NULL,
	"investment_id" varchar,
	"isin" varchar,
	"scheme_name" varchar,
	"folio_number" varchar,
	"allocation_percentage" numeric(5, 2) DEFAULT '100',
	"allocated_amount" numeric(15, 2),
	"current_value" numeric(15, 2),
	"sip_amount" numeric(10, 2),
	"sip_frequency" varchar,
	"sip_start_date" timestamp,
	"sip_end_date" timestamp,
	"total_invested" numeric(15, 2) DEFAULT '0',
	"absolute_returns" numeric(15, 2),
	"xirr" numeric(8, 4),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "goal_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"target_percentage" numeric(5, 2) NOT NULL,
	"target_amount" numeric(15, 2) NOT NULL,
	"target_date" timestamp,
	"is_achieved" boolean DEFAULT false,
	"achieved_at" timestamp,
	"achieved_amount" numeric(15, 2),
	"notify_on_achieve" boolean DEFAULT true,
	"celebration_type" varchar DEFAULT 'confetti',
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "goal_progress_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" varchar NOT NULL,
	"snapshot_date" timestamp DEFAULT now(),
	"current_amount" numeric(15, 2) NOT NULL,
	"target_amount" numeric(15, 2) NOT NULL,
	"progress_percentage" numeric(5, 2) NOT NULL,
	"projected_value" numeric(15, 2),
	"on_track_status" varchar NOT NULL,
	"investments_value" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "government_scheme_audit" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"scheme_type" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"request_id" varchar NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"provider_trace_id" varchar,
	"data_checksum" varchar,
	"details" jsonb,
	"retention_expires_at" timestamp NOT NULL,
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
	"data_source" varchar DEFAULT 'nse_ncb',
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "government_securities_isin_unique" UNIQUE("isin")
);
--> statement-breakpoint
CREATE TABLE "historical_nav_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(50) NOT NULL,
	"identifier_type" varchar(20) NOT NULL,
	"date" date NOT NULL,
	"nav" numeric NOT NULL,
	"open" numeric,
	"high" numeric,
	"low" numeric,
	"close" numeric,
	"volume" numeric,
	"source" varchar(30) NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "immutable_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"action" varchar(100) NOT NULL,
	"user_id" varchar(255),
	"user_role" varchar(50),
	"entity_type" varchar(100),
	"entity_id" varchar(255),
	"previous_state" jsonb,
	"new_state" jsonb,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"previous_checksum" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "inbound_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_sid" varchar(100) NOT NULL,
	"channel" varchar(20) NOT NULL,
	"direction" varchar(20) DEFAULT 'inbound' NOT NULL,
	"from_number" varchar(50) NOT NULL,
	"to_number" varchar(50) NOT NULL,
	"body" text NOT NULL,
	"num_media" integer DEFAULT 0,
	"media_urls" text[],
	"user_id" varchar,
	"parsed_command" varchar(50),
	"command_args" text[],
	"auto_reply_response" text,
	"processed" boolean DEFAULT false,
	"admin_notes" text,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"read_by" varchar,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income_streams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"income_type" varchar NOT NULL,
	"source_name" varchar NOT NULL,
	"gross_amount" numeric(15, 2) NOT NULL,
	"net_amount" numeric(15, 2) NOT NULL,
	"frequency" varchar DEFAULT 'monthly' NOT NULL,
	"currency" varchar DEFAULT 'INR',
	"is_guaranteed" boolean DEFAULT true,
	"stability_score" integer DEFAULT 100,
	"variability_percent" numeric(5, 2) DEFAULT '0',
	"is_verified" boolean DEFAULT false,
	"verification_method" varchar,
	"verification_date" timestamp,
	"start_date" date,
	"end_date" date,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inspection_evidence" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"transaction_id" varchar,
	"proposal_id" varchar,
	"client_risk_profile" jsonb,
	"recommendation_mode" varchar NOT NULL,
	"agent_overrides" jsonb,
	"ai_explanation_shown" text,
	"client_consent" jsonb,
	"execution_record" jsonb,
	"exported_at" timestamp,
	"exported_by" varchar,
	"export_format" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instrument_master" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isin" varchar NOT NULL,
	"symbol" varchar,
	"isin_prefix" varchar(3),
	"instrument_family" varchar,
	"issuer_type" varchar,
	"primary_regulator" varchar,
	"secondary_regulator" varchar,
	"compliance_regime" varchar,
	"name" varchar NOT NULL,
	"short_name" varchar,
	"asset_class" varchar NOT NULL,
	"sub_type" varchar,
	"category" varchar,
	"issuer" varchar,
	"sector" varchar,
	"region" varchar,
	"country" varchar(2),
	"exchange" varchar,
	"market_type" varchar,
	"last_price" numeric(15, 4),
	"currency" varchar DEFAULT 'INR',
	"price_source" varchar,
	"price_updated_at" timestamp,
	"coupon" numeric(8, 4),
	"face_value" numeric(15, 4),
	"maturity_date" timestamp,
	"credit_rating" varchar,
	"risk_level" varchar,
	"is_perpetual" boolean DEFAULT false,
	"is_structured" boolean DEFAULT false,
	"is_gold_linked" boolean DEFAULT false,
	"is_convertible" boolean DEFAULT false,
	"is_secured" boolean DEFAULT false,
	"has_equity_flag" boolean DEFAULT false,
	"source_table" varchar,
	"source_id" varchar,
	"is_active" boolean DEFAULT true,
	"is_edge_case_instrument" boolean DEFAULT false,
	"validation_status" varchar DEFAULT 'pending',
	"validation_notes" text,
	"metadata" jsonb,
	"first_seen_at" timestamp DEFAULT now(),
	"last_verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "instrument_master_isin_unique" UNIQUE("isin")
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
CREATE TABLE "investable_surplus" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"calculation_date" timestamp DEFAULT now(),
	"period_type" varchar DEFAULT 'annual' NOT NULL,
	"total_gross_income" numeric(15, 2) NOT NULL,
	"total_net_income" numeric(15, 2) NOT NULL,
	"income_breakdown" jsonb,
	"total_obligations" numeric(15, 2) NOT NULL,
	"obligations_breakdown" jsonb,
	"emergency_buffer_amount" numeric(15, 2) NOT NULL,
	"emergency_buffer_status" varchar NOT NULL,
	"annual_investable_surplus" numeric(15, 2) NOT NULL,
	"monthly_investable_surplus" numeric(15, 2) NOT NULL,
	"surplus_stability" varchar DEFAULT 'stable',
	"confidence_score" integer DEFAULT 80,
	"surplus_recommendations" jsonb,
	"created_at" timestamp DEFAULT now()
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
CREATE TABLE "investment_inquiries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_type" text NOT NULL,
	"product_id" varchar NOT NULL,
	"product_name" text NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"pan_number" text,
	"investment_amount" numeric(15, 2),
	"investment_timeline" text,
	"message" text,
	"status" text DEFAULT 'new',
	"priority" text DEFAULT 'medium',
	"assigned_to" varchar,
	"last_contacted_at" timestamp,
	"next_follow_up_at" timestamp,
	"notes" text,
	"source" text DEFAULT 'marketplace',
	"utm_source" text,
	"utm_campaign" text,
	"kyc_status" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investment_limit_override_proposals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"product_category" varchar NOT NULL,
	"product_sub_category" varchar,
	"isin" varchar,
	"override_type" varchar NOT NULL,
	"current_investor_type" varchar,
	"proposed_investor_type" varchar,
	"current_min_investment" numeric(18, 2),
	"proposed_min_investment" numeric(18, 2),
	"current_max_investment" numeric(18, 2),
	"proposed_max_investment" numeric(18, 2),
	"current_brokerage_percent" numeric(8, 4),
	"proposed_brokerage_percent" numeric(8, 4),
	"justification" text NOT NULL,
	"supporting_documents" jsonb DEFAULT '[]'::jsonb,
	"risk_assessment_notes" text,
	"compliance_review_notes" text,
	"valid_from" timestamp NOT NULL,
	"valid_until" timestamp NOT NULL,
	"proposed_by" varchar NOT NULL,
	"proposer_role" varchar NOT NULL,
	"proposed_at" timestamp DEFAULT now(),
	"status" varchar DEFAULT 'pending',
	"level1_reviewed_by" varchar,
	"level1_reviewed_at" timestamp,
	"level1_status" varchar,
	"level1_notes" text,
	"level2_reviewed_by" varchar,
	"level2_reviewed_at" timestamp,
	"level2_status" varchar,
	"level2_notes" text,
	"final_approved_by" varchar,
	"final_approved_at" timestamp,
	"final_approval_notes" text,
	"rejected_by" varchar,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"revoked_by" varchar,
	"revoked_at" timestamp,
	"revocation_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"ai_sub_type" varchar,
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
	"is_demo" boolean DEFAULT false,
	"demo_converted_at" timestamp,
	"demo_converted_by" varchar,
	"demo_view_count" integer DEFAULT 0,
	"demo_last_viewed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "investor_brokerage_structures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investor_type" varchar NOT NULL,
	"product_category" varchar NOT NULL,
	"product_sub_category" varchar,
	"brokerage_fee_percent" numeric(8, 4) NOT NULL,
	"min_brokerage_fee" numeric(12, 2) DEFAULT '0',
	"max_brokerage_fee" numeric(12, 2),
	"platform_fee_percent" numeric(8, 4) DEFAULT '0',
	"flat_platform_fee" numeric(12, 2) DEFAULT '0',
	"exchange_charge_percent" numeric(8, 6) DEFAULT '0.0001',
	"clearing_charge_percent" numeric(8, 6) DEFAULT '0.00005',
	"sebi_fee_percent" numeric(8, 6) DEFAULT '0.00001',
	"stamp_duty_percent" numeric(8, 4) DEFAULT '0.0001',
	"gst_percent" numeric(5, 2) DEFAULT '18.00',
	"depository" varchar,
	"demat_charge_percent" numeric(8, 6) DEFAULT '0',
	"flat_demat_charge" numeric(10, 2) DEFAULT '0',
	"typical_yield_impact_bps" integer DEFAULT 0,
	"volume_discount_tiers" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"effective_from" timestamp DEFAULT now(),
	"effective_to" timestamp,
	"regulatory_reference" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "investor_classification_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"classification_type" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"description" text,
	"min_investment_amount" numeric(18, 2) NOT NULL,
	"max_investment_amount" numeric(18, 2),
	"min_net_worth" numeric(18, 2),
	"min_aum" numeric(18, 2),
	"required_kyc_tier" varchar DEFAULT 'basic' NOT NULL,
	"requires_sebi_registration" boolean DEFAULT false,
	"requires_professional_qualification" boolean DEFAULT false,
	"eligible_entity_types" text[] DEFAULT '{}'::text[],
	"allotment_method" varchar NOT NULL,
	"ipo_quota_percentage" numeric(5, 2),
	"can_bid_at_cutoff" boolean DEFAULT false,
	"can_withdraw_bid" boolean DEFAULT true,
	"lock_in_period_days" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"effective_from" timestamp DEFAULT now(),
	"effective_to" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"name" text NOT NULL,
	"sponsor" text,
	"manager" text,
	"trustee" text,
	"listing_date" timestamp,
	"exchange" varchar DEFAULT 'NSE',
	"isin_code" varchar,
	"sector" varchar NOT NULL,
	"infrastructure_type" varchar,
	"geography" text,
	"total_assets" integer,
	"asset_details" text,
	"concession_life" numeric(5, 1),
	"current_price" numeric(15, 4),
	"nav" numeric(15, 4),
	"premium_to_nav" numeric(8, 4),
	"week_high_52" numeric(15, 4),
	"week_low_52" numeric(15, 4),
	"market_cap" numeric(20, 2),
	"distribution_yield" numeric(8, 4),
	"dividend_frequency" varchar DEFAULT 'quarterly',
	"last_dividend" numeric(10, 4),
	"last_dividend_date" timestamp,
	"returns_1m" numeric(8, 4),
	"returns_3m" numeric(8, 4),
	"returns_6m" numeric(8, 4),
	"returns_1y" numeric(8, 4),
	"returns_3y" numeric(8, 4),
	"returns_since_inception" numeric(8, 4),
	"debt_to_equity" numeric(10, 4),
	"interest_coverage_ratio" numeric(10, 4),
	"ebitda" numeric(15, 2),
	"cash_flow_from_operations" numeric(15, 2),
	"minimum_investment" numeric(15, 2),
	"lot_size" integer DEFAULT 1,
	"face_value" numeric(10, 2),
	"risk_level" varchar DEFAULT 'moderate',
	"credit_rating" varchar,
	"rating_agency" varchar,
	"ai_signal" varchar DEFAULT 'hold',
	"ai_confidence" numeric(5, 2),
	"ai_rationale" text,
	"ai_target_price" numeric(15, 4),
	"is_active" boolean DEFAULT true,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "invits_symbol_unique" UNIQUE("symbol")
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
CREATE TABLE "itr_pricing_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itr_form_type" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"description" text,
	"self_file_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"self_file_gst" numeric(10, 2) DEFAULT '0',
	"ca_assisted_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"ca_assisted_gst" numeric(10, 2) DEFAULT '0',
	"ca_revenue_share_percent" numeric(5, 2) DEFAULT '50',
	"expert_consultation_fee" numeric(10, 2) DEFAULT '0',
	"rush_filing_fee" numeric(10, 2) DEFAULT '0',
	"late_fee_multiplier" numeric(4, 2) DEFAULT '1.0',
	"complexity_level" varchar DEFAULT 'standard',
	"estimated_processing_days" integer DEFAULT 3,
	"eligible_for_self_file" boolean DEFAULT true,
	"requires_ca" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"effective_from" timestamp DEFAULT now(),
	"effective_to" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar,
	"updated_by" varchar,
	CONSTRAINT "itr_pricing_config_itr_form_type_unique" UNIQUE("itr_form_type")
);
--> statement-breakpoint
CREATE TABLE "knowledge_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"user_role" varchar(30) NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"resource_type" varchar(50),
	"resource_id" varchar,
	"client_id" varchar,
	"client_name" varchar(255),
	"content_id" varchar,
	"content_version" integer,
	"disclaimer_version_hash" varchar(64),
	"action_details" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"record_hash" varchar(64),
	"previous_record_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_disclaimers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"short_content" text,
	"version" integer DEFAULT 1 NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp DEFAULT now() NOT NULL,
	"effective_until" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_hub_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"enabled_for_roles" jsonb DEFAULT '["agent","partner"]'::jsonb,
	"market_brief_enabled" boolean DEFAULT true,
	"market_brief_auto_publish" boolean DEFAULT false,
	"market_brief_generation_time" varchar(5) DEFAULT '06:00',
	"certification_enabled" boolean DEFAULT true,
	"certification_required" boolean DEFAULT false,
	"sharing_enabled" boolean DEFAULT true,
	"share_rate_limit" integer DEFAULT 50,
	"ai_explanation_enabled" boolean DEFAULT true,
	"ai_generation_rate_limit" integer DEFAULT 100,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "kyc_upgrade_reminders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"reminder_type" varchar NOT NULL,
	"reminder_sequence" integer NOT NULL,
	"current_kyc_tier" varchar NOT NULL,
	"target_kyc_tier" varchar NOT NULL,
	"missing_steps" text[],
	"email_sent" boolean DEFAULT false,
	"email_sent_at" timestamp,
	"in_app_created" boolean DEFAULT false,
	"in_app_notification_id" varchar,
	"sms_sent" boolean DEFAULT false,
	"sms_sent_at" timestamp,
	"user_acknowledged" boolean DEFAULT false,
	"acknowledged_at" timestamp,
	"scheduled_for" timestamp NOT NULL,
	"sent_at" timestamp,
	"status" varchar DEFAULT 'pending',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
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
CREATE TABLE "kyc_verification_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"session_type" varchar DEFAULT 'smart_kyc_wizard',
	"current_step" varchar DEFAULT 'pan_verification' NOT NULL,
	"step_status" jsonb DEFAULT '{}'::jsonb,
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
CREATE TABLE "lead_activity_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"activity_type" varchar NOT NULL,
	"activity_sub_type" varchar,
	"subject" varchar,
	"description" text,
	"call_duration" integer,
	"call_recording_url" varchar,
	"from_stage" varchar,
	"to_stage" varchar,
	"performed_by" varchar NOT NULL,
	"performed_by_type" varchar,
	"outcome" varchar,
	"next_action" text,
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
CREATE TABLE "lender_staff" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" varchar NOT NULL,
	"staff_code" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar,
	"designation" varchar NOT NULL,
	"department" varchar DEFAULT 'sales',
	"branch_code" varchar,
	"branch_name" varchar,
	"region_code" varchar,
	"zone_code" varchar,
	"reports_to_id" varchar,
	"employee_id" varchar,
	"joining_date" timestamp,
	"confirmation_date" timestamp,
	"status" varchar DEFAULT 'active' NOT NULL,
	"status_reason" text,
	"status_changed_at" timestamp,
	"status_changed_by" varchar,
	"is_escalation_contact" boolean DEFAULT false,
	"escalation_level" integer,
	"total_leads_assigned" integer DEFAULT 0,
	"total_conversions" integer DEFAULT 0,
	"total_disbursements" integer DEFAULT 0,
	"total_disbursed_amount" numeric(15, 2) DEFAULT '0',
	"avg_processing_days" numeric(5, 2),
	"last_performance_review" timestamp,
	"specializations" jsonb DEFAULT '[]'::jsonb,
	"certifications" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "lender_staff_staff_code_unique" UNIQUE("staff_code")
);
--> statement-breakpoint
CREATE TABLE "lender_staff_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" varchar NOT NULL,
	"change_type" varchar NOT NULL,
	"previous_provider_id" varchar,
	"previous_designation" varchar,
	"previous_status" varchar,
	"previous_branch_code" varchar,
	"previous_reports_to_id" varchar,
	"new_provider_id" varchar,
	"new_designation" varchar,
	"new_status" varchar,
	"new_branch_code" varchar,
	"new_reports_to_id" varchar,
	"effective_date" timestamp NOT NULL,
	"reason" text,
	"remarks" text,
	"relieving_date" timestamp,
	"last_working_day" timestamp,
	"exit_interview_notes" text,
	"is_eligible_for_rehire" boolean,
	"leave_type" varchar,
	"leave_start_date" timestamp,
	"leave_end_date" timestamp,
	"leads_reassigned_to" varchar,
	"leads_reassigned_count" integer DEFAULT 0,
	"changed_by" varchar NOT NULL,
	"changed_by_role" varchar,
	"ip_address" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "listed_stocks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"isin" varchar,
	"bse_code" varchar,
	"nse_code" varchar,
	"company_name" text NOT NULL,
	"cin" varchar,
	"company_pan" varchar,
	"sector" varchar,
	"broad_sector" varchar,
	"industry" varchar,
	"market_cap" varchar,
	"index_membership" jsonb DEFAULT '[]'::jsonb,
	"exchange_info" jsonb DEFAULT '{}'::jsonb,
	"current_price" numeric(15, 2),
	"previous_close" numeric(15, 2),
	"day_change" numeric(10, 2),
	"day_change_percent" numeric(8, 4),
	"week_high_52" numeric(15, 2),
	"week_low_52" numeric(15, 2),
	"market_cap_value" numeric(20, 2),
	"pe_ratio" numeric(10, 2),
	"pb_ratio" numeric(10, 2),
	"dividend_yield" numeric(8, 4),
	"eps" numeric(15, 2),
	"book_value" numeric(15, 2),
	"roe" numeric(8, 2),
	"roce" numeric(8, 2),
	"returns_1m" numeric(8, 4),
	"returns_3m" numeric(8, 4),
	"returns_6m" numeric(8, 4),
	"returns_1y" numeric(8, 4),
	"returns_3y" numeric(8, 4),
	"returns_5y" numeric(8, 4),
	"beta" numeric(6, 4),
	"volatility" numeric(8, 4),
	"risk_level" varchar,
	"analyst_rating" varchar,
	"target_price" numeric(15, 2),
	"number_of_analysts" integer,
	"average_volume" numeric(15, 0),
	"face_value" numeric(10, 2) DEFAULT '10',
	"lot_size" integer DEFAULT 1,
	"minimum_investment" numeric(15, 2) DEFAULT '0',
	"is_published" boolean DEFAULT false,
	"published_at" timestamp,
	"published_by" varchar,
	"selection_notes" text,
	"investment_thesis" text,
	"data_source" varchar DEFAULT 'nse',
	"enrichment_status" varchar DEFAULT 'pending',
	"last_enriched_at" timestamp,
	"enrichment_source" varchar,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "listed_stocks_symbol_unique" UNIQUE("symbol"),
	CONSTRAINT "listed_stocks_isin_unique" UNIQUE("isin"),
	CONSTRAINT "listed_stocks_cin_unique" UNIQUE("cin"),
	CONSTRAINT "listed_stocks_company_pan_unique" UNIQUE("company_pan")
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
	"loan_request_id" varchar,
	"product_key" varchar,
	"provider_key" varchar,
	"requested_amount" numeric(15, 2),
	"approved_amount" numeric(15, 2),
	"interest_rate" numeric(5, 2),
	"tenure_months" integer,
	"status" varchar,
	"application_date" timestamp,
	"decision_date" timestamp,
	"disbursement_date" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_commission_ledger" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"commission_config_id" varchar,
	"provider_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"loan_amount" numeric(15, 2) NOT NULL,
	"disbursement_date" timestamp,
	"commissionable_base" numeric(15, 2) NOT NULL,
	"commission_rate" numeric(6, 4) NOT NULL,
	"gross_commission" numeric(12, 2) NOT NULL,
	"tds_rate" numeric(5, 2) DEFAULT '5.00',
	"tds_amount" numeric(12, 2) DEFAULT '0',
	"gst_rate" numeric(5, 2) DEFAULT '18.00',
	"gst_amount" numeric(12, 2) DEFAULT '0',
	"net_commission" numeric(12, 2) NOT NULL,
	"fintekpro_amount" numeric(12, 2) NOT NULL,
	"partner_amount" numeric(12, 2) DEFAULT '0',
	"agent_amount" numeric(12, 2) DEFAULT '0',
	"management_override_amount" numeric(12, 2) DEFAULT '0',
	"partner_id" varchar,
	"agent_id" varchar,
	"manager_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"invoice_number" varchar,
	"invoice_date" timestamp,
	"payment_due_date" timestamp,
	"payment_date" timestamp,
	"payment_reference" varchar,
	"payment_mode" varchar,
	"is_clawed_back" boolean DEFAULT false,
	"clawback_reason" text,
	"clawback_amount" numeric(12, 2),
	"clawback_date" timestamp,
	"zoho_invoice_id" varchar,
	"zoho_payment_id" varchar,
	"zoho_sync_status" varchar DEFAULT 'pending',
	"zoho_sync_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "loan_eligibility_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_code" varchar NOT NULL,
	"loan_type" varchar NOT NULL,
	"rule_name" varchar NOT NULL,
	"min_credit_score" integer,
	"max_credit_score" integer,
	"min_monthly_income" numeric(15, 2),
	"min_annual_income" numeric(15, 2),
	"min_age" integer,
	"max_age" integer,
	"min_work_experience" integer,
	"allowed_employment_types" text[] DEFAULT ARRAY[]::text[],
	"excluded_employment_types" text[] DEFAULT ARRAY[]::text[],
	"allowed_states" text[] DEFAULT ARRAY[]::text[],
	"excluded_pincodes" text[] DEFAULT ARRAY[]::text[],
	"max_foir" numeric(5, 2),
	"priority" integer DEFAULT 50,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar NOT NULL,
	"source_id" varchar,
	"campaign_id" varchar,
	"utm_source" varchar,
	"utm_medium" varchar,
	"utm_campaign" varchar,
	"user_id" varchar,
	"customer_name" varchar NOT NULL,
	"email" varchar,
	"phone" varchar NOT NULL,
	"alternate_phone" varchar,
	"city" varchar,
	"state" varchar,
	"pincode" varchar,
	"product_id" varchar,
	"requested_amount" numeric(15, 2),
	"requested_tenure" integer,
	"purpose" text,
	"employment_type" varchar,
	"monthly_income" numeric(15, 2),
	"existing_emis" numeric(15, 2),
	"credit_score" integer,
	"lead_score" integer DEFAULT 0,
	"scoring_factors" jsonb DEFAULT '{}'::jsonb,
	"qualification_status" varchar DEFAULT 'new',
	"assigned_to_staff_id" varchar,
	"assigned_to_agent_id" varchar,
	"assigned_at" timestamp,
	"reassignment_count" integer DEFAULT 0,
	"funnel_stage" varchar DEFAULT 'inquiry' NOT NULL,
	"sub_stage" varchar,
	"last_contacted_at" timestamp,
	"next_follow_up_at" timestamp,
	"contact_attempts" integer DEFAULT 0,
	"preferred_providers" jsonb DEFAULT '[]'::jsonb,
	"application_id" varchar,
	"is_converted" boolean DEFAULT false,
	"conversion_date" timestamp,
	"rejection_reason" text,
	"drop_reason" text,
	"priority" varchar DEFAULT 'normal',
	"is_hot_lead" boolean DEFAULT false,
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
	"loan_type" varchar,
	"requested_amount" numeric(15, 2),
	"tenure_months" integer,
	"purpose" varchar,
	"employment_type" varchar,
	"monthly_income" numeric(15, 2),
	"status" varchar DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_routing_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"bank_code" varchar NOT NULL,
	"routing_strategy" varchar,
	"routing_priority" integer,
	"submitted_at" timestamp DEFAULT now(),
	"submission_method" varchar,
	"submission_reference" varchar,
	"payload_hash" varchar,
	"bank_status" varchar DEFAULT 'pending',
	"bank_reference" varchar,
	"response_received_at" timestamp,
	"approved_amount" numeric(15, 2),
	"approved_tenure" integer,
	"offered_interest_rate" numeric(5, 2),
	"processing_fee" numeric(15, 2),
	"rejection_reason" varchar,
	"query_details" text,
	"query_response_deadline" timestamp,
	"sanction_letter_url" varchar,
	"disbursed_amount" numeric(15, 2),
	"disbursed_at" timestamp,
	"disbursement_reference" varchar,
	"sla_breached" boolean DEFAULT false,
	"escalated_at" timestamp,
	"retry_count" integer DEFAULT 0,
	"last_retry_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_webhook_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_code" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"external_reference" varchar,
	"raw_payload" jsonb,
	"signature" varchar,
	"is_signature_valid" boolean,
	"processed_at" timestamp,
	"processing_status" varchar DEFAULT 'pending',
	"processing_error" text,
	"application_id" varchar,
	"routing_history_id" varchar,
	"received_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lrs_compliance_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"financial_year" varchar(7) NOT NULL,
	"total_remitted_usd" numeric DEFAULT '0',
	"total_remitted_inr" numeric DEFAULT '0',
	"remaining_limit_usd" numeric DEFAULT '250000',
	"lrs_limit_usd" numeric DEFAULT '250000',
	"last_transaction_date" date,
	"transaction_count" integer DEFAULT 0,
	"purposes" jsonb,
	"bank_accounts" jsonb,
	"fatca_status" varchar(20) DEFAULT 'pending',
	"fatca_declaration_date" date,
	"crs_status" varchar(20) DEFAULT 'pending',
	"form_15ca_filed" boolean DEFAULT false,
	"form_15cb_obtained" boolean DEFAULT false,
	"tax_residency_certificate" boolean DEFAULT false,
	"w8ben_filed" boolean DEFAULT false,
	"w8ben_expiry_date" date,
	"notes" text,
	"is_blocked" boolean DEFAULT false,
	"block_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lrs_limit_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"financial_year" varchar(10) NOT NULL,
	"alert_type" varchar(30) NOT NULL,
	"message" text NOT NULL,
	"utilization_percentage" numeric,
	"total_remitted_usd" numeric,
	"remaining_limit_usd" numeric,
	"acknowledged" boolean DEFAULT false,
	"acknowledged_at" timestamp,
	"acknowledged_by" varchar,
	"triggered_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lrs_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tracking_id" varchar NOT NULL,
	"transaction_date" date NOT NULL,
	"amount_usd" numeric NOT NULL,
	"amount_inr" numeric NOT NULL,
	"exchange_rate" numeric NOT NULL,
	"purpose" varchar(50) NOT NULL,
	"purpose_code" varchar(10),
	"beneficiary_name" varchar(255),
	"beneficiary_country" varchar(50),
	"beneficiary_bank" varchar(255),
	"ad_bank_name" varchar(255),
	"ad_bank_branch" varchar(255),
	"swift_reference" varchar(50),
	"form_15ca_number" varchar(50),
	"form_15cb_number" varchar(50),
	"tcs_rate" numeric,
	"tcs_amount" numeric,
	"status" varchar(20) DEFAULT 'completed',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "market_briefs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"region" varchar(20) DEFAULT 'india' NOT NULL,
	"market_snapshot" text NOT NULL,
	"what_changed" text NOT NULL,
	"key_risks" text,
	"opportunity_areas" text,
	"portfolio_impact" text,
	"compliance_note" text,
	"data_sources_used" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"approved_by" varchar,
	"approved_at" timestamp,
	"published_at" timestamp,
	"rejection_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"previous_version_id" varchar,
	"disclaimer_version_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "market_data_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(50) NOT NULL,
	"exchange" varchar(20),
	"data_type" varchar(30) NOT NULL,
	"last_price" numeric,
	"previous_close" numeric,
	"open" numeric,
	"high" numeric,
	"low" numeric,
	"volume" bigint,
	"change" numeric,
	"change_percent" numeric,
	"additional_data" jsonb DEFAULT '{}'::jsonb,
	"provider" varchar(50) NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_data_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_type" varchar(50) NOT NULL,
	"asset_id" varchar(100) NOT NULL,
	"asset_name" varchar(255),
	"exchange" varchar(20),
	"current_price" numeric(18, 4),
	"previous_close" numeric(18, 4),
	"day_high" numeric(18, 4),
	"day_low" numeric(18, 4),
	"week_high_52" numeric(18, 4),
	"week_low_52" numeric(18, 4),
	"nav" numeric(18, 4),
	"return_1d" numeric(8, 4),
	"return_1w" numeric(8, 4),
	"return_1m" numeric(8, 4),
	"return_3m" numeric(8, 4),
	"return_6m" numeric(8, 4),
	"return_1y" numeric(8, 4),
	"return_3y" numeric(8, 4),
	"return_5y" numeric(8, 4),
	"return_si" numeric(8, 4),
	"volume" bigint,
	"aum" numeric(18, 2),
	"yield_to_maturity" numeric(8, 4),
	"coupon_rate" numeric(8, 4),
	"data_source" varchar(50),
	"snapshot_date" date NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_stale" boolean DEFAULT false,
	"raw_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "market_product_matrix" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_code" varchar(10) NOT NULL,
	"product_category" varchar(50) NOT NULL,
	"product_sub_category" varchar(50),
	"is_enabled" boolean DEFAULT false,
	"advisory_level" varchar(20) DEFAULT 'ANALYTICS_ONLY' NOT NULL,
	"requires_accredited_investor" boolean DEFAULT false,
	"minimum_investment" numeric(18, 2),
	"minimum_investment_currency" varchar(3),
	"risk_category" varchar(20),
	"required_client_segments" text[],
	"excluded_client_segments" text[],
	"etf_only_restriction" boolean DEFAULT false,
	"compliance_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar,
	"updated_by" varchar
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
CREATE TABLE "markets_master" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_code" varchar(10) NOT NULL,
	"market_name" varchar(100) NOT NULL,
	"region" varchar(50) NOT NULL,
	"advisory_level" varchar(20) DEFAULT 'ANALYTICS_ONLY' NOT NULL,
	"execution_allowed" boolean DEFAULT false,
	"base_currency" varchar(3) NOT NULL,
	"timezone" varchar(50) NOT NULL,
	"regulatory_body" varchar(100),
	"regulatory_notes" text,
	"is_enabled" boolean DEFAULT false,
	"rollout_phase" integer DEFAULT 1,
	"enabled_environments" text[] DEFAULT ARRAY['development'],
	"display_order" integer DEFAULT 100,
	"flag_emoji" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar,
	"updated_by" varchar,
	CONSTRAINT "markets_master_market_code_unique" UNIQUE("market_code")
);
--> statement-breakpoint
CREATE TABLE "mca_charges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cin" varchar(21) NOT NULL,
	"charge_id" varchar(50) NOT NULL,
	"charge_holder" varchar(500) NOT NULL,
	"charge_holder_type" varchar(100),
	"charge_amount" numeric,
	"charge_type" varchar(100),
	"creation_date" date NOT NULL,
	"modification_date" date,
	"satisfaction_date" date,
	"status" varchar(50) DEFAULT 'active',
	"asset_description" text,
	"document_number" varchar(100),
	"filing_date" date,
	"days_overdue" integer DEFAULT 0,
	"source_document" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mca_company_master" (
	"cin" varchar(21) PRIMARY KEY NOT NULL,
	"company_name" varchar(500) NOT NULL,
	"company_status" varchar(50),
	"incorporation_date" date,
	"registered_state" varchar(100),
	"registered_city" varchar(100),
	"registered_address" text,
	"company_category" varchar(100),
	"company_sub_category" varchar(100),
	"company_class" varchar(50),
	"authorized_capital" numeric,
	"paid_up_capital" numeric,
	"last_filing_year" varchar(10),
	"last_annual_return" date,
	"last_balance_sheet" date,
	"email" varchar(255),
	"industry" varchar(255),
	"source_attribution" varchar(100) DEFAULT 'MCA V3 Public Filings',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mca_data_sources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_name" varchar(100) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"form_types" jsonb DEFAULT '[]'::jsonb,
	"refresh_cycle" varchar(50) DEFAULT 'daily',
	"is_enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"api_endpoint" varchar(500),
	"auth_type" varchar(50),
	"rate_limit_per_minute" integer DEFAULT 60,
	"cost_per_query" numeric DEFAULT '0',
	"last_sync_at" timestamp,
	"status" varchar(30) DEFAULT 'active',
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mca_data_sources_source_name_unique" UNIQUE("source_name")
);
--> statement-breakpoint
CREATE TABLE "mca_derived_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cin" varchar(21) NOT NULL,
	"financial_year" varchar(10) NOT NULL,
	"revenue_growth_yoy" numeric,
	"pat_growth_yoy" numeric,
	"net_worth_growth_yoy" numeric,
	"asset_growth_yoy" numeric,
	"pat_margin" numeric,
	"ebitda_margin" numeric,
	"gross_margin" numeric,
	"operating_margin" numeric,
	"return_on_equity" numeric,
	"return_on_assets" numeric,
	"return_on_capital_employed" numeric,
	"debt_to_equity" numeric,
	"debt_to_assets" numeric,
	"interest_coverage_ratio" numeric,
	"current_ratio" numeric,
	"quick_ratio" numeric,
	"cash_ratio" numeric,
	"asset_turnover" numeric,
	"inventory_turnover" numeric,
	"receivables_turnover" numeric,
	"revenue_trend" varchar(20),
	"profit_trend" varchar(20),
	"debt_trend" varchar(20),
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"data_completeness" numeric DEFAULT '0',
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "mca_direct_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cin" varchar(21) NOT NULL,
	"company_name" varchar(500),
	"fee_type" varchar(100) NOT NULL,
	"filing_year" varchar(10),
	"amount" numeric NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"status" varchar(30) DEFAULT 'initiated' NOT NULL,
	"mca_challan_number" varchar(100),
	"mca_transaction_id" varchar(100),
	"mca_payment_date" date,
	"mca_receipt_url" text,
	"payment_mode" varchar(50),
	"bank_name" varchar(100),
	"initiated_by" varchar(255) NOT NULL,
	"initiated_by_user_id" varchar(255),
	"confirmed_by" varchar(255),
	"confirmed_at" timestamp,
	"zoho_expense_id" varchar(100),
	"zoho_sync_status" varchar(30) DEFAULT 'pending',
	"zoho_sync_error" text,
	"zoho_synced_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mca_director_company_map" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"din" varchar(20) NOT NULL,
	"cin" varchar(21) NOT NULL,
	"designation" varchar(100) NOT NULL,
	"appointment_date" date,
	"cessation_date" date,
	"is_currently_active" boolean DEFAULT true,
	"shareholding" numeric,
	"remuneration" numeric,
	"is_independent" boolean DEFAULT false,
	"is_executive" boolean DEFAULT false,
	"source_document" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mca_directors" (
	"din" varchar(20) PRIMARY KEY NOT NULL,
	"name" varchar(500) NOT NULL,
	"designation" varchar(100),
	"nationality" varchar(100),
	"date_of_birth" date,
	"father_name" varchar(500),
	"address" text,
	"email" varchar(255),
	"pan" varchar(15),
	"total_appointments" integer DEFAULT 0,
	"active_appointments" integer DEFAULT 0,
	"din_status" varchar(50) DEFAULT 'active',
	"disqualification_date" date,
	"disqualification_reason" text,
	"source_attribution" varchar(100) DEFAULT 'MCA Public Data',
	"data_last_refreshed" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mca_filing_tracker" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cin" varchar(21) NOT NULL,
	"company_name" varchar(500),
	"filing_type" varchar(50) NOT NULL,
	"filing_year" varchar(10) NOT NULL,
	"downloaded_by" varchar(100) NOT NULL,
	"downloaded_by_role" varchar(50),
	"download_date" timestamp DEFAULT now() NOT NULL,
	"wallet_cost" numeric DEFAULT '0',
	"status" varchar(20) DEFAULT 'SUCCESS' NOT NULL,
	"failure_reason" text,
	"document_url" varchar(500),
	"file_size" integer,
	"processing_status" varchar(30) DEFAULT 'PENDING',
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "mca_financial_snapshot" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cin" varchar(21) NOT NULL,
	"financial_year" varchar(10) NOT NULL,
	"revenue" numeric,
	"profit_before_tax" numeric,
	"profit_after_tax" numeric,
	"net_worth" numeric,
	"total_assets" numeric,
	"total_liabilities" numeric,
	"share_capital" numeric,
	"reserves" numeric,
	"long_term_borrowing" numeric,
	"short_term_borrowing" numeric,
	"source" varchar(50) DEFAULT 'MCA_AOC4_XBRL' NOT NULL,
	"derived_at" timestamp DEFAULT now() NOT NULL,
	"derived_by" varchar(100),
	"is_verified" boolean DEFAULT false,
	"verified_by" varchar(100),
	"verified_at" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "mca_ingestion_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" varchar(100) NOT NULL,
	"source_id" varchar,
	"source_name" varchar(100) NOT NULL,
	"operation_type" varchar(50) NOT NULL,
	"target_cins" jsonb DEFAULT '[]'::jsonb,
	"form_types" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(30) DEFAULT 'running',
	"total_records" integer DEFAULT 0,
	"processed_records" integer DEFAULT 0,
	"failed_records" integer DEFAULT 0,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer,
	"error_messages" jsonb DEFAULT '[]'::jsonb,
	"retry_count" integer DEFAULT 0,
	"api_calls_made" integer DEFAULT 0,
	"wallet_cost" numeric DEFAULT '0',
	"triggered_by" varchar(100),
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "mca_query_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"user_name" varchar(255),
	"user_role" varchar(50),
	"query_type" varchar(100) NOT NULL,
	"cin" varchar(21),
	"company_name" varchar(500),
	"query_parameters" jsonb,
	"action_taken" varchar(255),
	"response_summary" text,
	"result_count" integer,
	"success" boolean DEFAULT true,
	"error_message" text,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mca_risk_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cin" varchar(21) NOT NULL,
	"assessment_date" date NOT NULL,
	"profit_consistency_score" integer,
	"leverage_risk_score" integer,
	"compliance_freshness_score" integer,
	"charges_risk_score" integer,
	"ownership_risk_score" integer,
	"governance_risk_score" integer,
	"overall_risk_score" integer NOT NULL,
	"risk_grade" varchar(20) NOT NULL,
	"score_breakdown" jsonb DEFAULT '{}'::jsonb,
	"risk_factors" jsonb DEFAULT '[]'::jsonb,
	"recommendations" text,
	"watchlist_flags" jsonb DEFAULT '[]'::jsonb,
	"computed_by" varchar(100),
	"methodology" varchar(50) DEFAULT 'v1',
	"is_latest" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mca_shareholding_pattern" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cin" varchar(21) NOT NULL,
	"reporting_date" date NOT NULL,
	"financial_year" varchar(10) NOT NULL,
	"quarter" varchar(5),
	"promoter_individual" numeric DEFAULT '0',
	"promoter_bodies" numeric DEFAULT '0',
	"promoter_total" numeric DEFAULT '0',
	"public_institutional" numeric DEFAULT '0',
	"public_non_institutional" numeric DEFAULT '0',
	"public_total" numeric DEFAULT '0',
	"mutual_funds" numeric DEFAULT '0',
	"fiis_fpis" numeric DEFAULT '0',
	"insurance_companies" numeric DEFAULT '0',
	"banks" numeric DEFAULT '0',
	"aifs_pms" numeric DEFAULT '0',
	"nbfcs" numeric DEFAULT '0',
	"employees" numeric DEFAULT '0',
	"retail_individuals" numeric DEFAULT '0',
	"hni" numeric DEFAULT '0',
	"trusts" numeric DEFAULT '0',
	"total_share_capital" numeric,
	"total_shares" numeric,
	"pledged_shares" numeric DEFAULT '0',
	"pledged_percentage" numeric DEFAULT '0',
	"source_document" varchar(100),
	"is_latest" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mca_version_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(100) NOT NULL,
	"change_type" varchar(30) NOT NULL,
	"previous_data" jsonb,
	"new_data" jsonb,
	"changed_fields" jsonb DEFAULT '[]'::jsonb,
	"source_document" varchar(100),
	"source_filing_date" date,
	"ingestion_run_id" varchar(100),
	"changed_by" varchar(100),
	"change_reason" text,
	"ip_address" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mca_wallet_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar(100) NOT NULL,
	"payment_session_id" varchar(255),
	"amount" numeric NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"initiated_by" varchar(255) NOT NULL,
	"initiated_by_user_id" varchar(255),
	"payment_url" text,
	"return_url" text,
	"transaction_id" varchar(255),
	"payment_method" varchar(50),
	"failure_reason" text,
	"credited_at" timestamp,
	"zoho_expense_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mca_wallet_payments_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "mca_wallet_status" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"current_balance" numeric DEFAULT '0' NOT NULL,
	"last_recharge_amount" numeric,
	"last_recharge_date" timestamp,
	"total_spent_this_month" numeric DEFAULT '0',
	"total_spent_all_time" numeric DEFAULT '0',
	"monthly_budget" numeric,
	"alert_threshold" numeric DEFAULT '1000',
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_bookings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"topic" text NOT NULL,
	"description" text,
	"scheduled_at" timestamp NOT NULL,
	"duration" integer DEFAULT 30,
	"timezone" text DEFAULT 'Asia/Kolkata',
	"zoho_meeting_id" text,
	"join_link" text,
	"start_link" text,
	"status" text DEFAULT 'pending',
	"client_notes" text,
	"agent_notes" text,
	"outcome" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"cancellation_reason" text
);
--> statement-breakpoint
CREATE TABLE "mf_batch_validation_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" varchar(100) NOT NULL,
	"agent_id" varchar,
	"arn_code" varchar(20) NOT NULL,
	"euin_code" varchar(20),
	"product_type" varchar(20) DEFAULT 'mutual_fund',
	"transaction_count" integer DEFAULT 0,
	"total_amount" numeric DEFAULT '0',
	"arn_valid" boolean DEFAULT false,
	"arn_status" text,
	"arn_expiry_date" date,
	"euin_valid" boolean,
	"euin_active" boolean,
	"can_proceed" boolean DEFAULT false,
	"requires_manual_review" boolean DEFAULT false,
	"blocking_reason" text,
	"warnings" jsonb DEFAULT '[]'::jsonb,
	"errors" jsonb DEFAULT '[]'::jsonb,
	"registry_response_hash" varchar(64),
	"registry_response_snapshot" jsonb,
	"validation_source" varchar(50),
	"validated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mf_contract_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"contract_note_number" varchar NOT NULL,
	"trade_date" date NOT NULL,
	"settlement_date" date,
	"pdf_url" text,
	"pdf_hash" varchar,
	"storage_reference" varchar,
	"email_sent_at" timestamp,
	"email_delivered_at" timestamp,
	"sms_sent_at" timestamp,
	"generated_at" timestamp DEFAULT now(),
	CONSTRAINT "mf_contract_notes_contract_note_number_unique" UNIQUE("contract_note_number")
);
--> statement-breakpoint
CREATE TABLE "mf_folios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"folio_number" varchar NOT NULL,
	"amc_code" varchar NOT NULL,
	"amc_name" varchar NOT NULL,
	"holder_name" varchar NOT NULL,
	"holder_pan" varchar,
	"joint_holder1_name" varchar,
	"joint_holder2_name" varchar,
	"holding_mode" varchar DEFAULT 'single',
	"bank_account_id" varchar,
	"bank_account_number" varchar,
	"bank_ifsc" varchar,
	"bank_name" varchar,
	"kyc_status" varchar DEFAULT 'pending',
	"fatca_status" varchar DEFAULT 'pending',
	"nominee_registered" boolean DEFAULT false,
	"data_source" varchar DEFAULT 'manual',
	"source_reference" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mf_holdings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"folio_id" varchar NOT NULL,
	"scheme_code" varchar NOT NULL,
	"scheme_name" varchar NOT NULL,
	"isin" varchar,
	"plan_type" varchar DEFAULT 'regular',
	"option_type" varchar,
	"units" numeric(15, 4) NOT NULL,
	"avg_nav" numeric(12, 4),
	"current_nav" numeric(12, 4),
	"nav_date" date,
	"invested_value" numeric(15, 2),
	"current_value" numeric(15, 2),
	"lock_in_end_date" date,
	"exit_load_applicable" boolean DEFAULT false,
	"exit_load_percent" numeric(5, 2),
	"exit_load_end_date" date,
	"pledge_status" varchar DEFAULT 'none',
	"pledged_units" numeric(15, 4),
	"pledge_reference" varchar,
	"last_transaction_date" date,
	"last_transaction_type" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mf_monthly_returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"scheme_code" text NOT NULL,
	"month_year" varchar(7) NOT NULL,
	"return_percent" numeric(10, 4),
	"nav_start" numeric(15, 6),
	"nav_end" numeric(15, 6),
	"start_date" date,
	"end_date" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mf_nav_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"scheme_code" text NOT NULL,
	"nav_date" date NOT NULL,
	"nav" numeric(15, 6) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mf_order_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"actor_id" varchar,
	"actor_role" varchar NOT NULL,
	"action" varchar NOT NULL,
	"previous_status" varchar,
	"new_status" varchar,
	"details" jsonb DEFAULT '{}'::jsonb,
	"notes" text,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mf_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_reference" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"advisor_id" varchar,
	"portfolio_id" varchar,
	"folio_id" varchar,
	"scheme_code" varchar NOT NULL,
	"scheme_name" varchar NOT NULL,
	"isin" varchar,
	"plan_type" varchar DEFAULT 'regular',
	"order_type" varchar NOT NULL,
	"amount" numeric(15, 2),
	"units" numeric(15, 4),
	"all_units" boolean DEFAULT false,
	"sip_amount" numeric(15, 2),
	"sip_frequency" varchar,
	"sip_start_date" date,
	"sip_end_date" date,
	"sip_installments" integer,
	"mandate_id" varchar,
	"payment_method" varchar,
	"payment_reference" varchar,
	"payment_status" varchar DEFAULT 'pending',
	"payment_completed_at" timestamp,
	"nav_date" date,
	"nav_applied" numeric(12, 4),
	"units_allotted" numeric(15, 4),
	"payout_bank_id" varchar,
	"payout_amount" numeric(15, 2),
	"exit_load_applied" numeric(15, 2),
	"tds_applied" numeric(15, 2),
	"settlement_date" date,
	"settlement_reference" varchar,
	"status" varchar DEFAULT 'created',
	"status_message" text,
	"rta_reference" varchar,
	"amc_reference" varchar,
	"bse_order_id" varchar,
	"compliance_flags" jsonb DEFAULT '{}'::jsonb,
	"suitability_ack_required" boolean DEFAULT false,
	"suitability_ack_provided" boolean DEFAULT false,
	"platform_fee" numeric(10, 2),
	"transaction_charges" numeric(10, 2),
	"gst" numeric(10, 2),
	"stamp_duty" numeric(10, 2),
	"initiated_by" varchar,
	"initiated_by_role" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"zoho_synced_at" timestamp,
	"zoho_sync_status" varchar(50),
	"placed_at" timestamp,
	"confirmed_at" timestamp,
	"settled_at" timestamp,
	"reconciled_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "mf_orders_order_reference_unique" UNIQUE("order_reference")
);
--> statement-breakpoint
CREATE TABLE "mf_reconciliation_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"rta_reference" varchar,
	"amc_reference" varchar,
	"expected_units" numeric(15, 4),
	"actual_units" numeric(15, 4),
	"expected_amount" numeric(15, 2),
	"actual_amount" numeric(15, 2),
	"variance" numeric(15, 4),
	"nav_date" date,
	"nav_applied" numeric(12, 4),
	"reconciliation_status" varchar DEFAULT 'pending',
	"exception_reason" text,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"raw_rta_response" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mf_scheme_exit_loads" (
	"id" serial PRIMARY KEY NOT NULL,
	"scheme_code" text NOT NULL,
	"isin" varchar(20),
	"tier" integer NOT NULL,
	"min_days" integer DEFAULT 0 NOT NULL,
	"max_days" integer,
	"exit_load_percent" numeric(5, 3) NOT NULL,
	"description" text,
	"source_url" text,
	"last_verified" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mf_tax_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"fund_type" varchar(50) NOT NULL,
	"holding_period_type" varchar(20) NOT NULL,
	"min_holding_days" integer NOT NULL,
	"max_holding_days" integer,
	"tax_rate" numeric(5, 2) NOT NULL,
	"exemption_limit" numeric(15, 2),
	"surcharge_applicable" boolean DEFAULT false,
	"cess_rate" numeric(5, 2) DEFAULT '4',
	"indexation_benefit" boolean DEFAULT false,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mld_master" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isin" text NOT NULL,
	"name" text NOT NULL,
	"issuer" text NOT NULL,
	"underlying" text NOT NULL,
	"payoff_type" text NOT NULL,
	"barrier_level" numeric(8, 4),
	"participation_rate" numeric(8, 4),
	"cap" numeric(8, 4),
	"floor" numeric(8, 4),
	"issue_date" date,
	"maturity_date" date NOT NULL,
	"observation_schedule" jsonb DEFAULT '[]'::jsonb,
	"face_value" numeric(15, 2) DEFAULT '1000000',
	"min_investment" numeric(15, 2) DEFAULT '1000000',
	"rating" text,
	"risk_score" integer,
	"credit_risk" text,
	"structural_risk" text,
	"liquidity_risk" text,
	"status" text DEFAULT 'active',
	"is_listed" boolean DEFAULT false,
	"is_published" boolean DEFAULT false,
	"liquidity_profile" text,
	"latest_price" numeric(15, 4),
	"last_price_date" date,
	"ytm" numeric(8, 4),
	"implied_yield" numeric(8, 4),
	"irr" numeric(8, 4),
	"term_sheet_path" text,
	"term_sheet_parsed" jsonb DEFAULT '{}'::jsonb,
	"suitability_score" integer,
	"ai_recommendation" text,
	"warning_indicators" jsonb DEFAULT '[]'::jsonb,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mld_master_isin_unique" UNIQUE("isin")
);
--> statement-breakpoint
CREATE TABLE "mld_monthwise_performance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mld_id" varchar NOT NULL,
	"month_year" date NOT NULL,
	"price_start" numeric(15, 4),
	"price_end" numeric(15, 4),
	"return_monthly" numeric(8, 4),
	"is_partial" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mld_price_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mld_id" varchar NOT NULL,
	"price_date" date NOT NULL,
	"price" numeric(15, 4) NOT NULL,
	"ytm" numeric(8, 4),
	"volume" numeric(15, 2),
	"source" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mutual_fund_amcs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"display_name" varchar,
	"logo_url" varchar,
	"regular_plans_enabled" boolean DEFAULT false,
	"direct_plans_enabled" boolean DEFAULT false,
	"total_schemes" integer DEFAULT 0,
	"published_regular_schemes" integer DEFAULT 0,
	"published_direct_schemes" integer DEFAULT 0,
	"last_toggled_at" timestamp,
	"last_toggled_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "mutual_fund_amcs_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "mutual_fund_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"fund_id" varchar,
	"scheme_code" varchar NOT NULL,
	"scheme_name" varchar,
	"fiscal_year" varchar(10) NOT NULL,
	"alpha" numeric(10, 4),
	"beta" numeric(8, 4),
	"sharpe_ratio" numeric(10, 4),
	"sortino_ratio" numeric(10, 4),
	"treynor_ratio" numeric(10, 4),
	"information_ratio" numeric(10, 4),
	"jensen_alpha" numeric(10, 4),
	"standard_deviation" numeric(10, 4),
	"semi_deviation" numeric(10, 4),
	"max_drawdown" numeric(10, 4),
	"var_95" numeric(10, 4),
	"cvar_95" numeric(10, 4),
	"upside_capture_ratio" numeric(10, 4),
	"downside_capture_ratio" numeric(10, 4),
	"capture_ratio" numeric(10, 4),
	"return_1m" numeric(10, 4),
	"return_3m" numeric(10, 4),
	"return_6m" numeric(10, 4),
	"return_1y" numeric(10, 4),
	"return_3y" numeric(10, 4),
	"return_5y" numeric(10, 4),
	"return_10y" numeric(10, 4),
	"return_since_inception" numeric(10, 4),
	"cagr_3y" numeric(10, 4),
	"cagr_5y" numeric(10, 4),
	"cagr_10y" numeric(10, 4),
	"sip_return_1y" numeric(10, 4),
	"sip_return_3y" numeric(10, 4),
	"sip_return_5y" numeric(10, 4),
	"xirr_3y" numeric(10, 4),
	"xirr_5y" numeric(10, 4),
	"aum" numeric(20, 2),
	"expense_ratio" numeric(8, 4),
	"portfolio_turnover" numeric(10, 4),
	"avg_market_cap" numeric(20, 2),
	"portfolio_pe_ratio" numeric(10, 4),
	"portfolio_pb_ratio" numeric(10, 4),
	"number_of_holdings" integer,
	"consistency_score" integer,
	"percentile_rank" numeric(8, 4),
	"category_rank" integer,
	"category_size" integer,
	"benchmark_index" varchar,
	"fund_category" varchar,
	"data_source" varchar(50),
	"calculated_at" timestamp DEFAULT now(),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
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
	"plan_type" varchar DEFAULT 'regular',
	"is_published" boolean DEFAULT false,
	"published_at" timestamp,
	"published_by" varchar,
	"amfi_code" varchar,
	"option_type" varchar,
	"scheme_status" varchar DEFAULT 'active',
	"last_verified_at" timestamp,
	"data_source" varchar,
	"last_updated" timestamp DEFAULT now(),
	CONSTRAINT "mutual_funds_scheme_code_unique" UNIQUE("scheme_code")
);
--> statement-breakpoint
CREATE TABLE "ncd_public_issues" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" varchar NOT NULL,
	"issuer_name" varchar NOT NULL,
	"issue_name" text NOT NULL,
	"isin" varchar,
	"issue_type" varchar NOT NULL,
	"ncd_category" varchar NOT NULL,
	"issue_open_date" date NOT NULL,
	"issue_close_date" date NOT NULL,
	"allotment_date" date,
	"listing_date" date,
	"maturity_date" date NOT NULL,
	"tenor_years" numeric(5, 2) NOT NULL,
	"face_value" numeric(15, 2) DEFAULT '1000',
	"issue_price" numeric(15, 2),
	"coupon_rate" numeric(8, 4) NOT NULL,
	"coupon_frequency" varchar NOT NULL,
	"effective_yield" numeric(8, 4),
	"issue_size" numeric(15, 2),
	"base_size_target" numeric(15, 2),
	"green_shoe_option" numeric(15, 2),
	"minimum_application" numeric(15, 2) DEFAULT '10000',
	"lot_size" integer DEFAULT 10,
	"credit_rating" varchar NOT NULL,
	"rating_agency" varchar NOT NULL,
	"outlook_status" varchar DEFAULT 'stable',
	"lead_managers" jsonb DEFAULT '[]'::jsonb,
	"registrar" varchar,
	"debenture_trustee" varchar,
	"secured" boolean DEFAULT true,
	"security_cover" numeric(5, 2),
	"collateral_type" text,
	"tax_status" varchar DEFAULT 'taxable',
	"tax_benefit_section" varchar,
	"category_allocation" jsonb DEFAULT '{}'::jsonb,
	"issue_status" varchar DEFAULT 'upcoming',
	"listing_exchange" varchar DEFAULT 'bse',
	"prospectus_url" text,
	"rating_rationale_url" text,
	"application_form_url" text,
	"total_subscription" numeric(15, 2),
	"subscription_times" numeric(8, 4),
	"retail_subscription_times" numeric(8, 4),
	"sebi_filing_date" date,
	"data_source" varchar DEFAULT 'manual',
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "ncd_public_issues_issue_id_unique" UNIQUE("issue_id")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"whatsapp_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"preferred_otp_channels" text[] DEFAULT ARRAY['email', 'whatsapp', 'sms'],
	"us_order_filled" boolean DEFAULT true NOT NULL,
	"us_order_cancelled" boolean DEFAULT true NOT NULL,
	"us_order_rejected" boolean DEFAULT true NOT NULL,
	"us_market_alerts" boolean DEFAULT true NOT NULL,
	"us_rebalancing_suggestions" boolean DEFAULT true NOT NULL,
	"order_updates" boolean DEFAULT true NOT NULL,
	"portfolio_alerts" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
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
CREATE TABLE "onboarding_invitation_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"event_data" jsonb,
	"actor_id" varchar,
	"actor_type" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_code" varchar NOT NULL,
	"inviter_id" varchar NOT NULL,
	"inviter_type" varchar NOT NULL,
	"inviter_name" varchar,
	"client_email" varchar,
	"client_mobile" varchar,
	"client_name" varchar,
	"suggested_entity_type" varchar,
	"suggested_mode" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"current_step" varchar,
	"completed_steps" jsonb DEFAULT '[]'::jsonb,
	"progress_percentage" integer DEFAULT 0,
	"onboarding_session_id" varchar,
	"linked_user_id" varchar,
	"invite_sent_at" timestamp,
	"invite_opened_at" timestamp,
	"onboarding_started_at" timestamp,
	"onboarding_completed_at" timestamp,
	"last_activity_at" timestamp,
	"expires_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_invitations_referral_code_unique" UNIQUE("referral_code")
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
CREATE TABLE "order_fee_consent_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"fee_mode" varchar(30) NOT NULL,
	"advisory_fee_applied" numeric(15, 2),
	"platform_fee_applied" numeric(15, 2),
	"total_fee_applied" numeric(15, 2) NOT NULL,
	"order_value_inr" numeric(15, 2) NOT NULL,
	"order_symbol" varchar(20),
	"order_side" varchar(10),
	"fee_breakdown_shown" boolean DEFAULT true NOT NULL,
	"consent_acknowledged" boolean DEFAULT false NOT NULL,
	"consent_timestamp" timestamp,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "order_refunds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"reason" text NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"gateway_refund_id" varchar,
	"initiated_by" varchar NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar NOT NULL,
	"otp" varchar(6) NOT NULL,
	"type" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"verified" boolean DEFAULT false,
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
	"icai_membership_number" varchar,
	"icai_membership_type" varchar,
	"ca_firm_name" varchar,
	"ca_firm_registration_number" varchar,
	"ca_specializations" text[] DEFAULT ARRAY[]::text[],
	"ca_experience_years" integer,
	"ca_qualification_year" integer,
	"ca_city" varchar,
	"ca_state" varchar,
	"ca_availability" varchar DEFAULT 'available',
	"ca_max_cases_per_month" integer DEFAULT 50,
	"ca_current_active_cases" integer DEFAULT 0,
	"ca_completed_cases" integer DEFAULT 0,
	"ca_average_rating" numeric(3, 2),
	"ca_total_ratings" integer DEFAULT 0,
	"ca_response_time" varchar DEFAULT '24h',
	"ca_verification_status" varchar DEFAULT 'pending',
	"ca_verified_at" timestamp,
	"ca_verified_by" varchar,
	"ca_profile_photo" varchar,
	"ca_bio" text,
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
CREATE TABLE "pending_appointments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"requested_role" varchar NOT NULL,
	"current_roles" varchar[] DEFAULT ARRAY[]::varchar[],
	"initiated_by_user_id" varchar NOT NULL,
	"initiated_by_role" varchar NOT NULL,
	"initiated_by_name" varchar,
	"cost_centre_id" varchar,
	"cost_centre_name" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"processed_by_admin_id" varchar,
	"processed_by_admin_name" varchar,
	"processed_at" timestamp,
	"rejection_reason" text,
	"user_profile" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"expires_at" timestamp
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
CREATE TABLE "pick_price_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"pick_id" integer NOT NULL,
	"user_id" varchar,
	"alert_type" varchar(20) NOT NULL,
	"trigger_price" numeric(18, 4) NOT NULL,
	"previous_price" numeric(18, 4),
	"message" text,
	"notification_sent" boolean DEFAULT false,
	"notification_channel" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pick_watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"pick_id" integer NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"price_alert_enabled" boolean DEFAULT false,
	"alert_threshold" numeric(8, 2),
	"alert_type" varchar(20),
	"last_alert_sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "platform_feature_flags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flag_key" varchar(100) NOT NULL,
	"flag_name" varchar(200) NOT NULL,
	"description" text,
	"is_enabled" boolean DEFAULT false,
	"default_value" jsonb,
	"enabled_environments" text[] DEFAULT ARRAY['development'],
	"targeting_rules" jsonb,
	"is_kill_switch" boolean DEFAULT false,
	"kill_switch_activated_at" timestamp,
	"kill_switch_reason" text,
	"category" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar,
	"updated_by" varchar,
	CONSTRAINT "platform_feature_flags_flag_key_unique" UNIQUE("flag_key")
);
--> statement-breakpoint
CREATE TABLE "platform_fee_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fee_code" varchar(50) NOT NULL,
	"fee_name" varchar(100) NOT NULL,
	"fee_description" text,
	"category" varchar(50) NOT NULL,
	"charge_type" varchar(20) DEFAULT 'percentage' NOT NULL,
	"rate_value" numeric(12, 6) NOT NULL,
	"rate_unit" varchar(20) DEFAULT 'percent',
	"min_amount" numeric(10, 2) DEFAULT '0',
	"max_amount" numeric(10, 2),
	"tier_slabs" jsonb,
	"applicable_to" varchar(50) DEFAULT 'all' NOT NULL,
	"applicable_products" text[],
	"excluded_products" text[],
	"investor_tier_rates" jsonb,
	"is_gst_applicable" boolean DEFAULT true,
	"gst_rate" numeric(5, 2) DEFAULT '18',
	"gst_included" boolean DEFAULT false,
	"payer" varchar(20) DEFAULT 'client',
	"collection_point" varchar(50) DEFAULT 'transaction',
	"is_regulatory" boolean DEFAULT false,
	"regulatory_reference" varchar(200),
	"statute_section" varchar(200),
	"is_waivable" boolean DEFAULT false,
	"max_waiver_percent" numeric(5, 2) DEFAULT '0',
	"display_order" integer DEFAULT 100,
	"show_in_breakdown" boolean DEFAULT true,
	"display_label" varchar(100),
	"is_active" boolean DEFAULT true,
	"effective_from" timestamp DEFAULT now(),
	"effective_to" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar,
	"updated_by" varchar,
	CONSTRAINT "platform_fee_config_fee_code_unique" UNIQUE("fee_code")
);
--> statement-breakpoint
CREATE TABLE "pms_master" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"registration_no" text,
	"strategy" text,
	"manager_id" varchar,
	"fund_house_name" text,
	"sponsor" text,
	"style" text,
	"min_investment" numeric(15, 2) DEFAULT '5000000',
	"lock_in" text,
	"benchmark" text,
	"fee_structure" text,
	"management_fee" numeric(5, 2),
	"performance_fee" numeric(5, 2),
	"fund_status" text DEFAULT 'active',
	"is_published" boolean DEFAULT false,
	"latest_nav" numeric(15, 4),
	"last_nav_date" date,
	"aum" numeric(20, 2),
	"return_1m" numeric(8, 4),
	"return_3m" numeric(8, 4),
	"return_6m" numeric(8, 4),
	"return_1y" numeric(8, 4),
	"return_3y" numeric(8, 4),
	"return_5y" numeric(8, 4),
	"return_since_inception" numeric(8, 4),
	"volatility" numeric(8, 4),
	"max_drawdown" numeric(8, 4),
	"sharpe_ratio" numeric(8, 4),
	"sortino_ratio" numeric(8, 4),
	"alpha" numeric(8, 4),
	"beta" numeric(8, 4),
	"risk_score" integer,
	"sebi_id" text,
	"inception_date" date,
	"description" text,
	"investment_objective" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pms_master_registration_no_unique" UNIQUE("registration_no")
);
--> statement-breakpoint
CREATE TABLE "portfolio_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"portfolio_id" varchar,
	"holding_id" varchar,
	"alert_type" varchar NOT NULL,
	"alert_category" varchar NOT NULL,
	"severity" varchar DEFAULT 'medium' NOT NULL,
	"alert_title" varchar NOT NULL,
	"alert_message" text NOT NULL,
	"alert_description" text,
	"trigger_metric" varchar,
	"trigger_value" numeric(15, 4),
	"trigger_threshold" numeric(15, 4),
	"trigger_direction" varchar,
	"benchmark_name" varchar,
	"benchmark_value" numeric(15, 4),
	"benchmark_change" numeric(8, 4),
	"symbol" varchar,
	"stock_name" varchar,
	"current_weight" numeric(8, 4),
	"recommended_weight" numeric(8, 4),
	"recommended_action" varchar,
	"action_urgency" varchar DEFAULT 'normal',
	"action_description" text,
	"ai_insight" text,
	"ai_recommendation" text,
	"agent_viewed" boolean DEFAULT false,
	"agent_viewed_at" timestamp,
	"agent_action" varchar,
	"agent_action_at" timestamp,
	"agent_notes" text,
	"client_notified" boolean DEFAULT false,
	"client_notified_at" timestamp,
	"client_viewed" boolean DEFAULT false,
	"client_viewed_at" timestamp,
	"status" varchar DEFAULT 'active',
	"resolved_at" timestamp,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
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
CREATE TABLE "portfolio_diagnostics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"analysis_date" timestamp DEFAULT now(),
	"portfolio_snapshot" jsonb NOT NULL,
	"portfolio_risk_score" numeric(5, 2) NOT NULL,
	"client_risk_tolerance" varchar NOT NULL,
	"risk_mismatch_percent" numeric(5, 2),
	"ideal_allocation" jsonb,
	"allocation_deviation" jsonb,
	"concentration_issues" jsonb DEFAULT '[]'::jsonb,
	"mf_overlap_percent" numeric(5, 2),
	"mf_overlap_details" jsonb DEFAULT '[]'::jsonb,
	"duration_mismatch" jsonb,
	"liquidity_issues" jsonb DEFAULT '[]'::jsonb,
	"underperformers" jsonb DEFAULT '[]'::jsonb,
	"tax_issues" jsonb DEFAULT '[]'::jsonb,
	"health_score" integer NOT NULL,
	"health_summary" text,
	"issue_count" jsonb DEFAULT '{"critical":0,"warning":0,"info":0}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_generated_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar,
	"portfolio_id" varchar,
	"template_id" varchar,
	"report_name" text NOT NULL,
	"config_snapshot" jsonb NOT NULL,
	"validation_results" jsonb,
	"file_url" text,
	"file_type" varchar DEFAULT 'pdf',
	"file_size" integer,
	"status" varchar DEFAULT 'pending',
	"hash_checksum" varchar,
	"error_message" text,
	"generated_by_user_id" varchar NOT NULL,
	"proposal_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "portfolio_holdings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" varchar NOT NULL,
	"symbol" text,
	"name" text,
	"isin" text,
	"quantity" numeric(15, 4) NOT NULL,
	"avg_price" numeric(15, 4),
	"current_value" numeric(15, 2),
	"invested_value" numeric(15, 2),
	"currency" varchar DEFAULT 'INR',
	"asset_type" text NOT NULL,
	"product_type" text,
	"asset_class" text,
	"sector" text,
	"folio_number" text,
	"broker" text,
	"market_cap" numeric(20, 0),
	"beta" numeric(5, 3),
	"dividend_yield" numeric(5, 2),
	"pe_ratio" numeric(8, 2),
	"confidence_score" integer,
	"source" varchar DEFAULT 'manual',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_metrics_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(50) NOT NULL,
	"identifier_type" varchar(20) NOT NULL,
	"period_years" integer NOT NULL,
	"period_end_date" date NOT NULL,
	"cagr" numeric,
	"volatility" numeric,
	"max_drawdown" numeric,
	"sharpe_ratio" numeric,
	"sortino_ratio" numeric,
	"beta" numeric,
	"alpha" numeric,
	"total_data_points" integer,
	"data_start_date" date,
	"data_end_date" date,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_metrics_daily" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"portfolio_id" varchar,
	"metrics_date" date NOT NULL,
	"total_value" numeric(18, 2),
	"total_cost" numeric(18, 2),
	"unrealized_gain_loss" numeric(18, 2),
	"day_change" numeric(18, 2),
	"day_change_percent" numeric(8, 4),
	"return_1d" numeric(8, 4),
	"return_1w" numeric(8, 4),
	"return_1m" numeric(8, 4),
	"return_3m" numeric(8, 4),
	"return_6m" numeric(8, 4),
	"return_1y" numeric(8, 4),
	"return_si" numeric(8, 4),
	"xirr" numeric(8, 4),
	"cagr" numeric(8, 4),
	"allocation_equity" numeric(6, 4),
	"allocation_debt" numeric(6, 4),
	"allocation_gold" numeric(6, 4),
	"allocation_cash" numeric(6, 4),
	"allocation_alternatives" numeric(6, 4),
	"allocation_international" numeric(6, 4),
	"portfolio_volatility" numeric(8, 4),
	"portfolio_beta" numeric(8, 4),
	"portfolio_sharpe" numeric(8, 4),
	"max_drawdown" numeric(8, 4),
	"risk_score" integer,
	"top_5_concentration" numeric(6, 4),
	"sector_concentration" jsonb,
	"drift_from_target" numeric(6, 4),
	"needs_rebalancing" boolean DEFAULT false,
	"total_holdings" integer,
	"equity_holdings" integer,
	"debt_holdings" integer,
	"mf_holdings" integer,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"computation_time_ms" integer
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
CREATE TABLE "portfolio_report_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_report_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_by_user_id" varchar NOT NULL,
	"config_json" jsonb NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_public" boolean DEFAULT false,
	"category" varchar DEFAULT 'general',
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
CREATE TABLE "portfolio_uploads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"portfolio_id" varchar,
	"upload_type" varchar NOT NULL,
	"file_name" varchar,
	"file_path" text,
	"file_size" integer,
	"file_hash" varchar,
	"parsing_status" varchar DEFAULT 'pending',
	"parsing_error" text,
	"parsed_at" timestamp,
	"parsed_holdings" jsonb,
	"parsed_summary" jsonb,
	"parsing_confidence" integer,
	"confirmation_required" boolean DEFAULT true,
	"confirmation_status" varchar DEFAULT 'pending',
	"confirmation_method" varchar,
	"confirmation_otp" varchar,
	"confirmation_otp_expires_at" timestamp,
	"confirmed_at" timestamp,
	"confirmed_by_client_id" varchar,
	"merged_to_portfolio_at" timestamp,
	"analysis_triggered_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"prospect_id" varchar,
	"name" text NOT NULL,
	"total_value" numeric(15, 2),
	"cash" numeric(15, 2) DEFAULT '0',
	"base_currency" varchar DEFAULT 'INR',
	"is_default" boolean DEFAULT false,
	"family_id" varchar,
	"is_shared" boolean DEFAULT false,
	"source" varchar DEFAULT 'manual',
	"source_file_name" varchar,
	"last_fetched_at" timestamp,
	"is_verified" boolean DEFAULT false,
	"last_fetch_status" varchar DEFAULT 'pending',
	"last_fetch_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"created_at" timestamp DEFAULT now(),
	"broad_sector" varchar,
	"company_pan" varchar,
	"enrichment_status" varchar DEFAULT 'pending',
	"last_enriched_at" timestamp,
	"enrichment_source" varchar
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
CREATE TABLE "probe42_sync_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"probe42_company_id" varchar NOT NULL,
	"sync_type" varchar NOT NULL,
	"last_sync_at" timestamp NOT NULL,
	"status" varchar NOT NULL,
	"records_synced" integer,
	"records_failed" integer,
	"error_message" text,
	"error_details" jsonb,
	"next_sync_scheduled" timestamp,
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
CREATE TABLE "product_eligibility_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_category" varchar NOT NULL,
	"product_sub_category" varchar,
	"isin" varchar,
	"allowed_investor_types" text[] DEFAULT '{}'::text[],
	"min_kyc_tier" varchar DEFAULT 'basic' NOT NULL,
	"allowed_risk_profiles" text[] DEFAULT '{}'::text[],
	"min_investment" numeric(18, 2) NOT NULL,
	"max_investment" numeric(18, 2),
	"min_investment_lot_size" numeric(18, 2),
	"requires_accredited_investor" boolean DEFAULT false,
	"min_net_worth" numeric(18, 2),
	"min_annual_income" numeric(18, 2),
	"min_portfolio_value" numeric(18, 2),
	"min_age" integer,
	"max_age" integer,
	"min_investment_experience_years" integer,
	"min_credit_rating" varchar,
	"requires_risk_disclosure" boolean DEFAULT true,
	"risk_disclosure_type" varchar DEFAULT 'standard',
	"requires_suitability_assessment" boolean DEFAULT false,
	"suitability_score_threshold" integer,
	"cooling_off_period_days" integer DEFAULT 0,
	"regulatory_body" varchar,
	"regulatory_circular" varchar,
	"compliance_notes" text,
	"is_active" boolean DEFAULT true,
	"effective_from" timestamp DEFAULT now(),
	"effective_to" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_fundamentals_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_type" varchar(50) NOT NULL,
	"product_id" varchar(100) NOT NULL,
	"product_name" varchar(255),
	"market_cap" numeric(18, 2),
	"pe_ratio" numeric(10, 2),
	"pb_ratio" numeric(10, 2),
	"eps" numeric(12, 4),
	"dividend_yield" numeric(8, 4),
	"roe" numeric(8, 4),
	"roce" numeric(8, 4),
	"debt_to_equity" numeric(10, 4),
	"revenue_growth_3y" numeric(8, 4),
	"profit_growth_3y" numeric(8, 4),
	"expense_ratio" numeric(6, 4),
	"exit_load" numeric(6, 4),
	"alpha" numeric(8, 4),
	"beta" numeric(8, 4),
	"sharpe_ratio" numeric(8, 4),
	"sortino_ratio" numeric(8, 4),
	"standard_deviation" numeric(8, 4),
	"max_drawdown" numeric(8, 4),
	"credit_rating" varchar(20),
	"credit_rating_agency" varchar(50),
	"maturity_date" date,
	"face_value" numeric(12, 2),
	"risk_score" integer,
	"volatility_score" integer,
	"liquidity_score" integer,
	"fintekpro_rating" numeric(4, 2),
	"morningstar_rating" integer,
	"value_research_rating" integer,
	"sector" varchar(100),
	"industry" varchar(100),
	"category" varchar(100),
	"subcategory" varchar(100),
	"flow_direction" varchar(20) DEFAULT 'inbound' NOT NULL,
	"regulatory_framework" varchar(100),
	"investor_type" varchar(100),
	"lrs_applicable" boolean DEFAULT false NOT NULL,
	"lrs_category" varchar(100),
	"fund_manager_id" varchar,
	"fund_manager_name" varchar(255),
	"data_source" varchar(50),
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ttl_hours" integer DEFAULT 24,
	"raw_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "product_knowledge" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_type" varchar(50) NOT NULL,
	"product_category" varchar(50),
	"product_sub_category" varchar(50),
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"key_features" jsonb DEFAULT '[]'::jsonb,
	"risk_profile" varchar(20) NOT NULL,
	"time_horizon" varchar(30),
	"suitability_rules" jsonb DEFAULT '[]'::jsonb,
	"contraindications" jsonb DEFAULT '[]'::jsonb,
	"compliance_tags" jsonb DEFAULT '[]'::jsonb,
	"regulatory_notes" text,
	"suggested_cert_level" varchar(5),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_by" varchar,
	"last_edited_by" varchar,
	"published_by" varchar,
	"published_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"edit_history" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "proposal_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"prospect_client_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"disclosure_acknowledged" boolean DEFAULT false,
	"disclosure_acknowledged_at" timestamp,
	"risk_acknowledged" boolean DEFAULT false,
	"risk_acknowledged_at" timestamp,
	"execution_consent" boolean DEFAULT false,
	"execution_consent_at" timestamp,
	"signature_type" varchar,
	"signature_data" jsonb,
	"signed_at" timestamp,
	"client_notes" text,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"deferred_until" timestamp,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_esign_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"action_category" varchar NOT NULL,
	"description" text NOT NULL,
	"actor_id" varchar,
	"actor_name" varchar,
	"actor_email" varchar,
	"actor_role" varchar,
	"actor_type" varchar,
	"participant_id" varchar,
	"version_id" varchar,
	"previous_state" jsonb,
	"new_state" jsonb,
	"metadata" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"device_type" varchar,
	"geo_location" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_esign_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" varchar NOT NULL,
	"version_id" varchar,
	"participant_id" varchar,
	"comment_type" varchar DEFAULT 'comment' NOT NULL,
	"content" text NOT NULL,
	"page_number" integer,
	"x_position" numeric(10, 4),
	"y_position" numeric(10, 4),
	"highlighted_text" text,
	"parent_comment_id" varchar,
	"thread_resolved" boolean DEFAULT false,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"is_internal" boolean DEFAULT false,
	"author_id" varchar,
	"author_name" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "proposal_esign_field_edits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" varchar NOT NULL,
	"version_id" varchar,
	"participant_id" varchar,
	"field_name" varchar NOT NULL,
	"field_path" varchar,
	"previous_value" text,
	"new_value" text,
	"change_type" varchar NOT NULL,
	"approval_status" varchar DEFAULT 'pending',
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejected_by" varchar,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"edited_by" varchar,
	"edited_by_name" varchar,
	"ip_address" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_esign_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" varchar NOT NULL,
	"user_id" varchar,
	"external_email" varchar,
	"external_name" varchar,
	"external_mobile" varchar,
	"role" varchar NOT NULL,
	"action_order" integer DEFAULT 1,
	"can_edit" boolean DEFAULT false,
	"can_comment" boolean DEFAULT true,
	"can_approve" boolean DEFAULT false,
	"can_sign" boolean DEFAULT false,
	"preferred_signature_method" varchar,
	"action_status" varchar DEFAULT 'pending',
	"action_required_by" timestamp,
	"has_edited" boolean DEFAULT false,
	"last_edited_at" timestamp,
	"edit_count" integer DEFAULT 0,
	"has_approved" boolean DEFAULT false,
	"approved_at" timestamp,
	"approval_notes" text,
	"has_signed" boolean DEFAULT false,
	"signed_at" timestamp,
	"signature_method" varchar,
	"signature_data" jsonb,
	"has_declined" boolean DEFAULT false,
	"declined_at" timestamp,
	"decline_reason" text,
	"first_viewed_at" timestamp,
	"last_viewed_at" timestamp,
	"view_count" integer DEFAULT 0,
	"email_sent_at" timestamp,
	"reminders_sent" integer DEFAULT 0,
	"last_reminder_at" timestamp,
	"ip_address" varchar,
	"user_agent" text,
	"device_info" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_esign_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" varchar NOT NULL,
	"version_number" integer NOT NULL,
	"negotiation_round" integer DEFAULT 1,
	"version_label" varchar,
	"document_url" varchar NOT NULL,
	"document_hash" varchar,
	"document_source" varchar DEFAULT 'generated',
	"original_file_format" varchar,
	"uploaded_by_user_id" varchar,
	"uploaded_at" timestamp,
	"file_size" integer,
	"change_description" text,
	"changes_from_previous" jsonb,
	"approval_status" varchar DEFAULT 'pending',
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejected_by" varchar,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"is_locked" boolean DEFAULT false,
	"locked_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_by_name" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_esign_workflows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"proposal_type" varchar NOT NULL,
	"document_number" varchar NOT NULL,
	"document_name" varchar NOT NULL,
	"document_type" varchar DEFAULT 'investment_agreement' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"original_document_url" varchar,
	"current_document_url" varchar,
	"signed_document_url" varchar,
	"document_hash" varchar,
	"document_source" varchar DEFAULT 'generated',
	"original_file_format" varchar,
	"uploaded_by_user_id" varchar,
	"uploaded_at" timestamp,
	"allow_editing" boolean DEFAULT false NOT NULL,
	"editing_locked_at" timestamp,
	"editing_locked_by" varchar,
	"is_sequential" boolean DEFAULT true NOT NULL,
	"require_all_signatures" boolean DEFAULT true NOT NULL,
	"negotiation_round" integer DEFAULT 1 NOT NULL,
	"deadline" timestamp,
	"reminder_days" integer DEFAULT 3,
	"escalation_days" integer DEFAULT 7,
	"escalation_email" varchar,
	"last_reminder_sent_at" timestamp,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"status_changed_at" timestamp DEFAULT now(),
	"status_changed_by" varchar,
	"completed_at" timestamp,
	"declined_at" timestamp,
	"declined_by" varchar,
	"decline_reason" text,
	"zoho_sign_request_id" varchar,
	"esign_transaction_id" varchar,
	"zoho_crm_deal_id" varchar,
	"zoho_crm_contact_id" varchar,
	"zoho_crm_synced_at" timestamp,
	"retention_policy_years" integer DEFAULT 8 NOT NULL,
	"retention_expires_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_by_role" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_esign_workflows_document_number_unique" UNIQUE("document_number")
);
--> statement-breakpoint
CREATE TABLE "proposal_holdings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"instrument_id" varchar,
	"isin" varchar NOT NULL,
	"security_name" varchar NOT NULL,
	"asset_class" varchar NOT NULL,
	"category" varchar,
	"issuer" varchar,
	"quantity" numeric(15, 4) NOT NULL,
	"buy_price" numeric(15, 4) NOT NULL,
	"buy_date" timestamp,
	"current_price" numeric(15, 4),
	"current_value" numeric(15, 2),
	"unrealized_gain_loss" numeric(15, 2),
	"unrealized_gain_loss_percent" numeric(8, 2),
	"imported_from" varchar,
	"notes" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_interactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"sender_type" varchar NOT NULL,
	"content" text NOT NULL,
	"revision_details" jsonb,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_materializations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"client_id" varchar,
	"agent_id" varchar,
	"proposal_type" varchar(50) NOT NULL,
	"input_hash" varchar(64) NOT NULL,
	"investment_amount" numeric(18, 2),
	"risk_profile" varchar(50),
	"investment_horizon" varchar(50),
	"goal_type" varchar(50),
	"basket_items" jsonb NOT NULL,
	"asset_allocation" jsonb NOT NULL,
	"pricing_snapshot" jsonb NOT NULL,
	"total_proposal_value" numeric(18, 2),
	"expected_return_1y" numeric(8, 4),
	"expected_return_3y" numeric(8, 4),
	"expected_return_5y" numeric(8, 4),
	"portfolio_risk_score" integer,
	"overall_rationale" text,
	"product_rationales" jsonb,
	"risk_disclosures" jsonb,
	"sebi_compliant" boolean DEFAULT true,
	"suitability_score" numeric(5, 4),
	"compliance_notes" jsonb,
	"status" varchar(20) DEFAULT 'draft',
	"shared_at" timestamp,
	"accepted_at" timestamp,
	"executed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"price_valid_until" timestamp,
	"hit_count" integer DEFAULT 0,
	"last_accessed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "proposal_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"session_id" varchar,
	"agent_id" varchar NOT NULL,
	"note_type" varchar NOT NULL,
	"note_position" varchar DEFAULT 'general',
	"content" text NOT NULL,
	"goal_id" varchar,
	"goal_priority" integer,
	"version" integer DEFAULT 1,
	"previous_version_id" varchar,
	"is_approved" boolean DEFAULT true,
	"approved_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "proposal_shares" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"session_id" varchar,
	"agent_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"share_method" varchar NOT NULL,
	"share_token" varchar,
	"share_token_expires_at" timestamp,
	"share_url" text,
	"document_path" text,
	"document_hash" varchar,
	"document_source" varchar DEFAULT 'generated',
	"original_file_format" varchar,
	"uploaded_by_user_id" varchar,
	"uploaded_at" timestamp,
	"view_count" integer DEFAULT 0,
	"first_viewed_at" timestamp,
	"last_viewed_at" timestamp,
	"client_action" varchar,
	"client_action_timestamp" timestamp,
	"client_comment" text,
	"client_signature" text,
	"email_sent_at" timestamp,
	"email_delivered_at" timestamp,
	"email_opened_at" timestamp,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "proposal_shares_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "prospect_clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"email" varchar,
	"mobile" varchar,
	"pan" varchar,
	"client_type" varchar DEFAULT 'individual',
	"indicative_risk_profile" varchar,
	"state" varchar DEFAULT 'prospect' NOT NULL,
	"portfolio_fetch_consent" boolean DEFAULT false,
	"portfolio_fetch_consent_at" timestamp,
	"advisory_consent" boolean DEFAULT false,
	"advisory_consent_at" timestamp,
	"fetched_portfolio" jsonb,
	"uploaded_portfolio" jsonb,
	"current_portfolio" jsonb,
	"portfolio_analysis" jsonb,
	"converted_user_id" varchar,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
	"employee_count" integer,
	"gst_status" varchar,
	"gst_number" varchar,
	"credit_rating" varchar,
	"credit_rating_agency" varchar,
	"credit_rating_outlook" varchar,
	"open_charges_count" integer,
	"total_charges_amount" numeric(15, 2),
	"charge_holders" jsonb,
	"suit_filed_cases_count" integer,
	"active_legal_cases" integer,
	"risk_indicators" jsonb,
	"enrichment_score" integer,
	"enrichment_sources" jsonb,
	"enrichment_data" jsonb,
	"enriched_at" timestamp,
	"incorporation_date" varchar,
	"company_type" varchar,
	"company_class" varchar,
	"sum_of_charges" numeric(18, 2),
	"active_compliance" varchar,
	"listing_status" varchar,
	"entity_type" varchar,
	"company_status" varchar,
	"roc_code" varchar,
	"number_of_members" integer,
	"last_agm_date" varchar,
	"last_balance_sheet_date" varchar,
	"converted_to_user_id" varchar,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prospect_proposal_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"event_data" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"referrer" varchar,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospect_proposals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_token" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"agent_name" varchar,
	"agent_arn_code" varchar,
	"agent_mobile" varchar,
	"agent_email" varchar,
	"prospect_name" varchar NOT NULL,
	"prospect_email" varchar,
	"prospect_mobile" varchar,
	"prospect_pan" varchar,
	"proposal_type" varchar NOT NULL,
	"client_type" varchar DEFAULT 'individual',
	"sample_portfolio" jsonb,
	"investment_goals" jsonb,
	"proposal_title" varchar NOT NULL,
	"executive_summary" text,
	"current_analysis" text,
	"recommendations" jsonb,
	"total_investment_amount" numeric(15, 2),
	"projected_returns" numeric(5, 2),
	"projected_value" numeric(15, 2),
	"target_allocation" jsonb,
	"global_advisory_selections" jsonb,
	"invitation_id" varchar,
	"referral_code" varchar,
	"view_count" integer DEFAULT 0,
	"last_viewed_at" timestamp,
	"first_viewed_at" timestamp,
	"shared_via_email" boolean DEFAULT false,
	"shared_via_whatsapp" boolean DEFAULT false,
	"email_sent_at" timestamp,
	"whatsapp_sent_at" timestamp,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"converted_user_id" varchar,
	"converted_at" timestamp,
	"valid_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prospect_proposals_share_token_unique" UNIQUE("share_token")
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
CREATE TABLE "provider_product_commissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"commission_type" varchar DEFAULT 'percentage' NOT NULL,
	"commission_base" varchar DEFAULT 'loan_amount' NOT NULL,
	"base_commission_rate" numeric(6, 4) NOT NULL,
	"min_commission" numeric(12, 2),
	"max_commission" numeric(12, 2),
	"slab_commissions" jsonb DEFAULT '[]'::jsonb,
	"volume_incentives" jsonb DEFAULT '[]'::jsonb,
	"fintekpro_share" numeric(5, 2) DEFAULT '40.00' NOT NULL,
	"partner_share" numeric(5, 2) DEFAULT '30.00',
	"agent_share" numeric(5, 2) DEFAULT '30.00',
	"management_override_rate" numeric(5, 2) DEFAULT '0.00',
	"payment_terms_days" integer DEFAULT 30,
	"payment_frequency" varchar DEFAULT 'monthly',
	"clawback_period_months" integer DEFAULT 3,
	"clawback_rate" numeric(5, 2) DEFAULT '100.00',
	"effective_from" timestamp DEFAULT now() NOT NULL,
	"effective_to" timestamp,
	"is_active" boolean DEFAULT true,
	"approved_by" varchar,
	"approved_at" timestamp,
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
CREATE TABLE "quiz_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb,
	"score" integer NOT NULL,
	"passed" boolean NOT NULL,
	"time_taken_seconds" integer,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rbi_retail_direct_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"rdg_account_number" varchar,
	"rdg_account_status" varchar DEFAULT 'pending',
	"linking_status" varchar DEFAULT 'not_linked',
	"linking_request_id" varchar,
	"linked_at" timestamp,
	"settlement_bank_name" varchar,
	"settlement_account_number" varchar,
	"settlement_ifsc_code" varchar,
	"last_holdings_sync" timestamp,
	"holdings_sync_status" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "rbi_retail_direct_accounts_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "rbi_retail_direct_accounts_rdg_account_number_unique" UNIQUE("rdg_account_number")
);
--> statement-breakpoint
CREATE TABLE "rebalance_summaries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"portfolio_id" varchar,
	"target_equity" numeric(6, 4),
	"target_debt" numeric(6, 4),
	"target_gold" numeric(6, 4),
	"target_cash" numeric(6, 4),
	"target_alternatives" numeric(6, 4),
	"current_equity" numeric(6, 4),
	"current_debt" numeric(6, 4),
	"current_gold" numeric(6, 4),
	"current_cash" numeric(6, 4),
	"current_alternatives" numeric(6, 4),
	"total_drift" numeric(6, 4),
	"drift_threshold" numeric(6, 4) DEFAULT '5.0',
	"exceeds_drift_threshold" boolean DEFAULT false,
	"suggested_buys" jsonb DEFAULT '[]'::jsonb,
	"suggested_sells" jsonb DEFAULT '[]'::jsonb,
	"suggested_switches" jsonb DEFAULT '[]'::jsonb,
	"estimated_stcg" numeric(18, 2),
	"estimated_ltcg" numeric(18, 2),
	"tax_efficiency_score" integer,
	"estimated_brokerage" numeric(12, 2),
	"estimated_exit_loads" numeric(12, 2),
	"rationale_hash_key" varchar(64),
	"rationale" text,
	"status" varchar(20) DEFAULT 'pending',
	"approved_by" varchar,
	"approved_at" timestamp,
	"executed_at" timestamp,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"computation_time_ms" integer
);
--> statement-breakpoint
CREATE TABLE "rebalancing_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"instrument_id" varchar,
	"symbol" varchar(20) NOT NULL,
	"instrument_name" varchar(255),
	"asset_class" varchar(30) NOT NULL,
	"market" varchar(10) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"action" varchar(10) NOT NULL,
	"priority" varchar(10) DEFAULT 'normal',
	"current_quantity" numeric,
	"recommended_quantity" numeric,
	"quantity_change" numeric,
	"current_price" numeric,
	"current_price_inr" numeric,
	"target_price" numeric,
	"stop_loss" numeric,
	"current_allocation" numeric,
	"target_allocation" numeric,
	"drift_percent" numeric,
	"trade_value_native" numeric,
	"trade_value_inr" numeric,
	"expected_return" numeric,
	"risk_score" numeric,
	"confidence_score" numeric,
	"rationale" text,
	"key_factors" jsonb,
	"risk_factors" jsonb,
	"tax_implications" jsonb,
	"lrs_impact" numeric,
	"compliance_flags" jsonb,
	"status" varchar(20) DEFAULT 'pending',
	"executed_at" timestamp,
	"executed_price" numeric,
	"executed_quantity" numeric,
	"execution_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rebalancing_recommendations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"recommendation_type" varchar NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"trigger_reason" varchar NOT NULL,
	"reason_code" varchar NOT NULL,
	"reason_description" text NOT NULL,
	"asset_class" varchar NOT NULL,
	"current_holding_id" varchar,
	"product_id" varchar,
	"product_name" varchar,
	"isin" varchar,
	"current_allocation" numeric(5, 2),
	"target_allocation" numeric(5, 2),
	"deviation_percent" numeric(5, 2),
	"current_value" numeric(15, 2),
	"recommended_amount" numeric(15, 2),
	"expected_impact" jsonb,
	"switch_to_product_id" varchar,
	"switch_to_product_name" varchar,
	"switch_rationale" text,
	"is_urgent" boolean DEFAULT false,
	"expires_at" timestamp,
	"status" varchar DEFAULT 'pending',
	"action_taken_at" timestamp,
	"action_taken_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rebalancing_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"snapshot_type" varchar(30) NOT NULL,
	"portfolio_scope" varchar(30) NOT NULL,
	"total_value_inr" numeric NOT NULL,
	"total_value_usd" numeric,
	"asset_allocation" jsonb,
	"geographic_allocation" jsonb,
	"sector_allocation" jsonb,
	"target_allocation" jsonb,
	"drift_analysis" jsonb,
	"risk_metrics" jsonb,
	"recommendation_summary" jsonb,
	"total_buy_value_inr" numeric,
	"total_sell_value_inr" numeric,
	"net_flow_inr" numeric,
	"lrs_utilized_ytd" numeric,
	"lrs_remaining_ytd" numeric,
	"rebalance_reason" text,
	"ai_insights" text,
	"status" varchar(20) DEFAULT 'pending',
	"executed_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "recommendation_explanations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_type" varchar NOT NULL,
	"recommendation_id" varchar NOT NULL,
	"why_this_product" text NOT NULL,
	"which_goal_served" varchar,
	"goal_id" varchar,
	"return_impact" text NOT NULL,
	"risk_impact" text NOT NULL,
	"portfolio_impact_before" jsonb,
	"portfolio_impact_after" jsonb,
	"suitability_check" jsonb,
	"alternatives_considered" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recommendation_performance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_type" varchar NOT NULL,
	"asset_code" varchar NOT NULL,
	"asset_name" text,
	"recommendation_type" varchar NOT NULL,
	"recommendation_date" timestamp NOT NULL,
	"recommended_price" numeric(15, 4),
	"target_price" numeric(15, 4),
	"ai_confidence" numeric(5, 2),
	"ai_rationale" text,
	"price_after_1_week" numeric(15, 4),
	"price_after_1_month" numeric(15, 4),
	"price_after_3_months" numeric(15, 4),
	"price_after_6_months" numeric(15, 4),
	"price_after_1_year" numeric(15, 4),
	"return_1_week" numeric(8, 4),
	"return_1_month" numeric(8, 4),
	"return_3_months" numeric(8, 4),
	"return_6_months" numeric(8, 4),
	"return_1_year" numeric(8, 4),
	"benchmark_return_1_month" numeric(8, 4),
	"benchmark_return_3_months" numeric(8, 4),
	"alpha_generated" numeric(8, 4),
	"hit_target" boolean,
	"is_success" boolean,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recommendation_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_type" varchar NOT NULL,
	"product_id" varchar,
	"name" text NOT NULL,
	"symbol" varchar,
	"amc" varchar,
	"category" varchar,
	"sector" varchar,
	"region" varchar,
	"country" varchar,
	"risk_profile" varchar NOT NULL,
	"returns_1y" varchar,
	"returns_3y" varchar,
	"returns_5y" varchar,
	"dividend_yield" varchar,
	"current_price" numeric(15, 2),
	"pe_ratio" numeric(10, 2),
	"market_cap" varchar,
	"risk_level" varchar,
	"minimum_investment" numeric(15, 2) DEFAULT '0',
	"lot_size" integer DEFAULT 1,
	"selection_rationale" text,
	"investment_thesis" text,
	"priority" integer DEFAULT 50,
	"is_active" boolean DEFAULT true,
	"requires_enhanced_kyc" boolean DEFAULT false,
	"added_by" varchar,
	"last_updated_by" varchar,
	"data_source" varchar DEFAULT 'manual',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_payout_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_level" varchar NOT NULL,
	"provider_id" varchar,
	"product_id" varchar,
	"agent_id" varchar,
	"partner_id" varchar,
	"payout_type" varchar DEFAULT 'percentage' NOT NULL,
	"payout_base" varchar DEFAULT 'commission' NOT NULL,
	"agent_payout_rate" numeric(5, 2) DEFAULT '30.00',
	"partner_payout_rate" numeric(5, 2) DEFAULT '30.00',
	"tiered_payouts" jsonb DEFAULT '[]'::jsonb,
	"level1_override_rate" numeric(5, 2) DEFAULT '5.00',
	"level2_override_rate" numeric(5, 2) DEFAULT '2.00',
	"level3_override_rate" numeric(5, 2) DEFAULT '1.00',
	"monthly_target_bonus" numeric(12, 2),
	"quarterly_target_bonus" numeric(12, 2),
	"annual_target_bonus" numeric(12, 2),
	"effective_from" timestamp DEFAULT now() NOT NULL,
	"effective_to" timestamp,
	"is_active" boolean DEFAULT true,
	"approved_by" varchar,
	"approval_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referral_payout_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commission_ledger_id" varchar NOT NULL,
	"payout_config_id" varchar,
	"beneficiary_type" varchar NOT NULL,
	"beneficiary_id" varchar NOT NULL,
	"beneficiary_name" varchar,
	"payout_amount" numeric(12, 2) NOT NULL,
	"payout_rate" numeric(5, 2),
	"tds_rate" numeric(5, 2) DEFAULT '5.00',
	"tds_amount" numeric(12, 2) DEFAULT '0',
	"net_payout_amount" numeric(12, 2) NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"bank_account_id" varchar,
	"payment_mode" varchar,
	"payment_reference" varchar,
	"payment_date" timestamp,
	"payment_remarks" text,
	"failure_reason" text,
	"retry_count" integer DEFAULT 0,
	"zoho_expense_id" varchar,
	"zoho_bill_id" varchar,
	"zoho_sync_status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "regulatory_bulletins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bulletin_code" varchar(50),
	"title" varchar(500) NOT NULL,
	"description" text,
	"regulatory_body" varchar(100) NOT NULL,
	"circular_number" varchar(100),
	"circular_date" date,
	"effective_date" date,
	"impact_level" varchar(20),
	"affected_entity_types" text[],
	"affected_agreement_types" text[],
	"affected_clause_codes" text[],
	"summary_text" text,
	"full_text_url" varchar(1000),
	"action_required" text,
	"compliance_deadline" date,
	"is_active" boolean DEFAULT true,
	"is_acknowledged" boolean DEFAULT false,
	"acknowledged_by" varchar,
	"acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "regulatory_bulletins_bulletin_code_unique" UNIQUE("bulletin_code")
);
--> statement-breakpoint
CREATE TABLE "regulatory_violation_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"transaction_id" varchar,
	"order_id" varchar,
	"violation_type" varchar NOT NULL,
	"violation_code" varchar NOT NULL,
	"violation_description" text NOT NULL,
	"product_category" varchar,
	"isin" varchar,
	"attempted_amount" numeric(18, 2),
	"allowed_limit" numeric(18, 2),
	"regulatory_rule" varchar,
	"resolution_status" varchar DEFAULT 'blocked',
	"resolution_notes" text,
	"override_proposal_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"resolved_by" varchar
);
--> statement-breakpoint
CREATE TABLE "reit_invit_holdings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"asset_type" varchar NOT NULL,
	"asset_id" varchar NOT NULL,
	"symbol" varchar NOT NULL,
	"asset_name" text,
	"quantity" integer NOT NULL,
	"average_cost" numeric(15, 4),
	"total_invested" numeric(15, 2),
	"current_value" numeric(15, 2),
	"unrealized_gain" numeric(15, 2),
	"unrealized_gain_percent" numeric(8, 4),
	"total_dividends_received" numeric(15, 2) DEFAULT '0',
	"last_dividend_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reit_invit_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_id" varchar,
	"isin" varchar,
	"name" varchar NOT NULL,
	"entity_type" varchar(10) NOT NULL,
	"fiscal_year" varchar(10) NOT NULL,
	"ffo" numeric(20, 2),
	"affo" numeric(20, 2),
	"ffo_per_unit" numeric(15, 4),
	"affo_per_unit" numeric(15, 4),
	"ffo_yield" numeric(10, 4),
	"price_to_ffo" numeric(10, 4),
	"price_to_affo" numeric(10, 4),
	"nav" numeric(20, 2),
	"nav_per_unit" numeric(15, 4),
	"price_to_nav" numeric(10, 4),
	"nav_premium_discount" numeric(10, 4),
	"distribution_yield" numeric(10, 4),
	"distribution_per_unit" numeric(15, 4),
	"annual_distribution" numeric(20, 2),
	"distribution_growth" numeric(10, 4),
	"payout_ratio" numeric(10, 4),
	"occupancy_rate" numeric(8, 4),
	"net_operating_income" numeric(20, 2),
	"cap_rate" numeric(10, 4),
	"leasable_area" numeric(15, 2),
	"wale" numeric(8, 2),
	"capacity_utilization" numeric(8, 4),
	"availability_factor" numeric(8, 4),
	"debt_to_assets" numeric(10, 4),
	"debt_to_ebitda" numeric(10, 4),
	"interest_coverage" numeric(12, 4),
	"total_return_1y" numeric(10, 4),
	"total_return_3y" numeric(10, 4),
	"total_return_since_ipo" numeric(10, 4),
	"data_source" varchar(50),
	"calculated_at" timestamp DEFAULT now(),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reit_invit_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"asset_type" varchar NOT NULL,
	"asset_id" varchar NOT NULL,
	"symbol" varchar NOT NULL,
	"asset_name" text,
	"order_type" varchar NOT NULL,
	"transaction_type" varchar DEFAULT 'market',
	"quantity" integer NOT NULL,
	"price_per_unit" numeric(15, 4),
	"total_amount" numeric(15, 2),
	"status" varchar DEFAULT 'pending',
	"executed_quantity" integer,
	"executed_price" numeric(15, 4),
	"executed_at" timestamp,
	"payment_status" varchar DEFAULT 'pending',
	"payment_reference" varchar,
	"settlement_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"name" text NOT NULL,
	"sponsor" text,
	"manager" text,
	"trustee" text,
	"listing_date" timestamp,
	"exchange" varchar DEFAULT 'NSE',
	"isin_code" varchar,
	"sector" varchar NOT NULL,
	"property_type" varchar,
	"geography" text,
	"total_properties" integer,
	"total_leasable_area" numeric(15, 2),
	"occupancy_rate" numeric(5, 2),
	"current_price" numeric(15, 4),
	"nav" numeric(15, 4),
	"premium_to_nav" numeric(8, 4),
	"week_high_52" numeric(15, 4),
	"week_low_52" numeric(15, 4),
	"market_cap" numeric(20, 2),
	"distribution_yield" numeric(8, 4),
	"dividend_frequency" varchar DEFAULT 'quarterly',
	"last_dividend" numeric(10, 4),
	"last_dividend_date" timestamp,
	"returns_1m" numeric(8, 4),
	"returns_3m" numeric(8, 4),
	"returns_6m" numeric(8, 4),
	"returns_1y" numeric(8, 4),
	"returns_3y" numeric(8, 4),
	"returns_since_inception" numeric(8, 4),
	"debt_to_equity" numeric(10, 4),
	"interest_coverage_ratio" numeric(10, 4),
	"funds_from_operations" numeric(15, 2),
	"net_operating_income" numeric(15, 2),
	"minimum_investment" numeric(15, 2),
	"lot_size" integer DEFAULT 1,
	"face_value" numeric(10, 2),
	"risk_level" varchar DEFAULT 'moderate',
	"credit_rating" varchar,
	"rating_agency" varchar,
	"ai_signal" varchar DEFAULT 'hold',
	"ai_confidence" numeric(5, 2),
	"ai_rationale" text,
	"ai_target_price" numeric(15, 4),
	"is_active" boolean DEFAULT true,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "reits_symbol_unique" UNIQUE("symbol")
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
CREATE TABLE "return_forecasts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_type" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"isin" varchar,
	"product_name" varchar,
	"expected_return_cagr" numeric(8, 4),
	"expected_return_irr" numeric(8, 4),
	"expected_yield" numeric(8, 4),
	"stress_return" numeric(8, 4),
	"max_drawdown" numeric(8, 4),
	"volatility" numeric(8, 4),
	"asset_specific_metrics" jsonb,
	"forecast_horizons" jsonb,
	"calculation_date" timestamp DEFAULT now(),
	"data_as_of_date" date,
	"calculation_method" varchar,
	"confidence_level" integer DEFAULT 80,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "risk_disclosure_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_code" varchar NOT NULL,
	"template_name" varchar NOT NULL,
	"product_category" varchar NOT NULL,
	"product_sub_category" varchar,
	"disclosure_type" varchar NOT NULL,
	"disclosure_title" varchar NOT NULL,
	"disclosure_content" text NOT NULL,
	"disclosure_content_hindi" text,
	"risk_factors" jsonb DEFAULT '[]'::jsonb,
	"regulatory_body" varchar,
	"regulatory_reference" varchar,
	"mandatory_for_investor_types" text[] DEFAULT '{}'::text[],
	"requires_explicit_acknowledgment" boolean DEFAULT true,
	"requires_digital_signature" boolean DEFAULT false,
	"acknowledgment_validity_days" integer DEFAULT 365,
	"version" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"effective_from" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "risk_disclosure_templates_template_code_unique" UNIQUE("template_code")
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
CREATE TABLE "scheduled_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"report_type" varchar(50) NOT NULL,
	"report_name" varchar(100) NOT NULL,
	"frequency" varchar(20) NOT NULL,
	"day_of_week" integer,
	"day_of_month" integer,
	"delivery_email" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sent_at" timestamp,
	"next_scheduled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheme_consents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"scheme_type" varchar NOT NULL,
	"purpose" text NOT NULL,
	"scope" text[] NOT NULL,
	"otp_channel" varchar NOT NULL,
	"challenge_id" varchar NOT NULL,
	"otp_hash" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"retention_period_years" integer DEFAULT 8 NOT NULL,
	"consent_timestamp" timestamp,
	"verified_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "scheme_consents_challenge_id_unique" UNIQUE("challenge_id")
);
--> statement-breakpoint
CREATE TABLE "sebi_ai_risk_recommendations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"current_assessment_id" varchar,
	"trigger_type" varchar NOT NULL,
	"trigger_details" jsonb,
	"current_profile_code" varchar NOT NULL,
	"suggested_profile_code" varchar NOT NULL,
	"recommendation_type" varchar NOT NULL,
	"confidence_score" numeric(3, 2) NOT NULL,
	"ai_explanation" text NOT NULL,
	"supporting_data" jsonb,
	"ai_model_used" varchar,
	"ai_engine_version" varchar,
	"status" varchar DEFAULT 'pending',
	"resolution_type" varchar,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"new_assessment_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sebi_clause_checklist" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clause_code" varchar(50) NOT NULL,
	"clause_category" varchar(100) NOT NULL,
	"clause_title" varchar(500) NOT NULL,
	"clause_description" text,
	"is_mandatory" boolean DEFAULT true,
	"is_conditional" boolean DEFAULT false,
	"condition_description" text,
	"applicable_entity_types" text[],
	"applicable_agreement_types" text[],
	"risk_weight" integer DEFAULT 1,
	"regulatory_reference" varchar(255),
	"suggested_clause_text" text,
	"is_active" boolean DEFAULT true,
	"effective_from" date,
	"effective_to" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sebi_clause_checklist_clause_code_unique" UNIQUE("clause_code")
);
--> statement-breakpoint
CREATE TABLE "sebi_client_risk_assessments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"pan" varchar NOT NULL,
	"questionnaire_version_id" varchar NOT NULL,
	"raw_score" numeric(5, 2) NOT NULL,
	"adjusted_score" numeric(5, 2),
	"profile_id" varchar NOT NULL,
	"profile_code" varchar NOT NULL,
	"has_override" boolean DEFAULT false,
	"override_reason" text,
	"override_type" varchar,
	"original_profile_code" varchar,
	"category_scores" jsonb,
	"answers" jsonb,
	"assessment_type" varchar DEFAULT 'initial',
	"trigger_event" varchar,
	"status" varchar DEFAULT 'active',
	"expires_at" timestamp,
	"next_review_date" timestamp,
	"client_consent_at" timestamp,
	"client_consent_ip" varchar,
	"assessed_by" varchar,
	"assessor_role" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sebi_depository_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dp_id" varchar NOT NULL,
	"dp_name" varchar NOT NULL,
	"sebi_registration_number" varchar NOT NULL,
	"depository" varchar NOT NULL,
	"nsdl_dp_id" varchar,
	"cdsl_dp_id" varchar,
	"is_primary_nsdl" boolean DEFAULT false,
	"is_primary_cdsl" boolean DEFAULT false,
	"registration_date" timestamp with time zone,
	"registration_valid_until" timestamp with time zone,
	"registered_address" text,
	"city" varchar,
	"state" varchar,
	"pincode" varchar,
	"contact_email" varchar,
	"contact_phone" varchar,
	"website" varchar,
	"status" varchar DEFAULT 'active' NOT NULL,
	"status_reason" text,
	"status_updated_at" timestamp with time zone,
	"last_sebi_verification" timestamp with time zone,
	"compliance_score" integer,
	"data_source" varchar NOT NULL,
	"external_id" varchar,
	"sync_hash" varchar,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sebi_depository_participants_dp_id_unique" UNIQUE("dp_id"),
	CONSTRAINT "sebi_depository_participants_nsdl_dp_id_unique" UNIQUE("nsdl_dp_id"),
	CONSTRAINT "sebi_depository_participants_cdsl_dp_id_unique" UNIQUE("cdsl_dp_id")
);
--> statement-breakpoint
CREATE TABLE "sebi_goal_risk_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"goal_id" varchar NOT NULL,
	"goal_name" varchar NOT NULL,
	"profile_code" varchar NOT NULL,
	"profile_id" varchar NOT NULL,
	"override_reason" text,
	"approved_by" varchar,
	"approved_at" timestamp,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sebi_product_suitability_matrix" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_type" varchar NOT NULL,
	"product_type_label" varchar NOT NULL,
	"allowed_rp1" boolean DEFAULT false,
	"allowed_rp2" boolean DEFAULT false,
	"allowed_rp3" boolean DEFAULT false,
	"allowed_rp4" boolean DEFAULT false,
	"allowed_rp5" boolean DEFAULT false,
	"min_investment_amount" numeric(15, 2),
	"requires_accredited_investor" boolean DEFAULT false,
	"requires_enhanced_kyc" boolean DEFAULT false,
	"min_net_worth" numeric(15, 2),
	"sebi_circular_ref" varchar,
	"regulatory_note" text,
	"sort_order" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sebi_questionnaire_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" varchar NOT NULL,
	"category_code" varchar NOT NULL,
	"category_name" varchar NOT NULL,
	"weight_percentage" numeric(5, 2) NOT NULL,
	"sort_order" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sebi_questionnaire_options" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" varchar NOT NULL,
	"option_code" varchar NOT NULL,
	"option_text" text NOT NULL,
	"score" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sebi_questionnaire_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" varchar NOT NULL,
	"version_id" varchar NOT NULL,
	"question_code" varchar NOT NULL,
	"question_text" text NOT NULL,
	"question_type" varchar NOT NULL,
	"help_text" text,
	"is_mandatory" boolean DEFAULT true,
	"sort_order" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sebi_questionnaire_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_number" varchar NOT NULL,
	"version_name" varchar,
	"effective_from" timestamp NOT NULL,
	"effective_to" timestamp,
	"is_active" boolean DEFAULT true,
	"approved_by" varchar,
	"approval_date" timestamp,
	"change_log" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sebi_questionnaire_versions_version_number_unique" UNIQUE("version_number")
);
--> statement-breakpoint
CREATE TABLE "sebi_risk_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"assessment_id" varchar,
	"recommendation_id" varchar,
	"action" varchar NOT NULL,
	"action_category" varchar NOT NULL,
	"actor_id" varchar,
	"actor_role" varchar,
	"previous_value" jsonb,
	"new_value" jsonb,
	"reason" text,
	"ip_address" varchar,
	"user_agent" text,
	"session_id" varchar,
	"questionnaire_version" varchar,
	"is_regulator_auditable" boolean DEFAULT true,
	"compliance_note" text,
	"retention_expires_at" timestamp,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sebi_risk_profiles_master" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_code" varchar NOT NULL,
	"profile_name" varchar NOT NULL,
	"risk_band" varchar NOT NULL,
	"description" text,
	"score_range_min" integer NOT NULL,
	"score_range_max" integer NOT NULL,
	"color_code" varchar,
	"sort_order" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sebi_risk_profiles_master_profile_code_unique" UNIQUE("profile_code")
);
--> statement-breakpoint
CREATE TABLE "sell_listings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_user_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"quantity" bigint NOT NULL,
	"ask_price" numeric(20, 2) NOT NULL,
	"landing_price" numeric(20, 2) NOT NULL,
	"floor_price" numeric(20, 2) NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"quantity_remaining" bigint,
	"valid_until" timestamp,
	"auto_renew" boolean DEFAULT false,
	"lock_in_period" integer,
	"minimum_lot_size" bigint,
	"notes" text,
	"kyc_verified" boolean DEFAULT false,
	"demat_verified" boolean DEFAULT false,
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
CREATE TABLE "sgb_primary_issues" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_name" varchar NOT NULL,
	"tranche_number" varchar NOT NULL,
	"fiscal_year" varchar NOT NULL,
	"issue_open_date" date NOT NULL,
	"issue_close_date" date NOT NULL,
	"settlement_date" date NOT NULL,
	"date_of_issuance" date NOT NULL,
	"maturity_date" date NOT NULL,
	"issue_price" numeric(15, 2) NOT NULL,
	"discount_online_payment" numeric(15, 2) DEFAULT '50',
	"effective_price" numeric(15, 2),
	"gold_reference_price" numeric(15, 2),
	"gold_reference_period_start" date,
	"gold_reference_period_end" date,
	"interest_rate" numeric(5, 2) DEFAULT '2.50',
	"interest_payment_frequency" varchar DEFAULT 'semi_annual',
	"minimum_investment" integer DEFAULT 1,
	"maximum_individual_limit" integer DEFAULT 4000,
	"maximum_huf_limit" integer DEFAULT 4000,
	"maximum_trust_limit" integer DEFAULT 20000,
	"early_redemption_allowed" boolean DEFAULT true,
	"early_redemption_from_year" integer DEFAULT 5,
	"capital_gains_tax_exempt" boolean DEFAULT true,
	"interest_taxable" boolean DEFAULT true,
	"application_channels" jsonb DEFAULT '["banks","post_offices","stock_exchanges","agents"]'::jsonb,
	"issue_status" varchar DEFAULT 'upcoming',
	"rbi_notification_number" varchar,
	"rbi_notification_date" date,
	"data_source" varchar DEFAULT 'rbi',
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "sgb_primary_issues_series_name_unique" UNIQUE("series_name")
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
CREATE TABLE "stamp_duty_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" varchar NOT NULL,
	"transaction_type" varchar NOT NULL,
	"product_type" varchar NOT NULL,
	"isin" varchar,
	"product_name" text,
	"transaction_amount" numeric(20, 2) NOT NULL,
	"stamp_duty_rate" numeric(8, 4) NOT NULL,
	"stamp_duty_amount" numeric(15, 2) NOT NULL,
	"is_exempt" boolean DEFAULT false,
	"exemption_reason" text,
	"payer_user_id" varchar,
	"payer_side" varchar NOT NULL,
	"payer_state" varchar,
	"config_snapshot_id" varchar,
	"regulator_reference" varchar,
	"statute_section" varchar,
	"effective_rate_date" date,
	"collection_status" varchar DEFAULT 'collected',
	"remittance_date" date,
	"remittance_batch_id" varchar,
	"calculated_at" timestamp DEFAULT now(),
	"calculated_by" varchar DEFAULT 'system',
	"retention_expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stamp_duty_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_type" varchar NOT NULL,
	"product_type_label" varchar NOT NULL,
	"stamp_duty_bps" numeric(8, 4) NOT NULL,
	"is_exempt" boolean DEFAULT false,
	"exemption_reason" text,
	"payer_side" varchar DEFAULT 'buyer' NOT NULL,
	"applicable_transaction_types" text[] DEFAULT '{}',
	"regulator_reference" varchar,
	"statute_section" varchar,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"collecting_agent" varchar DEFAULT 'platform',
	"remittance_frequency" varchar DEFAULT 'monthly',
	"state_code" varchar,
	"is_active" boolean DEFAULT true,
	"last_updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "stamp_duty_config_product_type_unique" UNIQUE("product_type")
);
--> statement-breakpoint
CREATE TABLE "stock_financial_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"stock_id" varchar,
	"isin" varchar,
	"symbol" varchar NOT NULL,
	"fiscal_year" varchar(10) NOT NULL,
	"fiscal_year_end" date,
	"trailing_pe" numeric(12, 4),
	"forward_pe" numeric(12, 4),
	"peg_ratio" numeric(10, 4),
	"price_to_book" numeric(10, 4),
	"price_to_sales" numeric(10, 4),
	"price_to_fcf" numeric(12, 4),
	"ev_to_ebitda" numeric(12, 4),
	"ev_to_sales" numeric(12, 4),
	"ev_to_ebit" numeric(12, 4),
	"enterprise_value" numeric(20, 2),
	"earnings_yield" numeric(10, 4),
	"gross_margin" numeric(10, 4),
	"operating_margin" numeric(10, 4),
	"net_margin" numeric(10, 4),
	"ebitda_margin" numeric(10, 4),
	"fcf_margin" numeric(10, 4),
	"roe" numeric(10, 4),
	"roa" numeric(10, 4),
	"roce" numeric(10, 4),
	"roic" numeric(10, 4),
	"revenue_growth_yoy" numeric(10, 4),
	"eps_growth_yoy" numeric(10, 4),
	"net_income_growth_yoy" numeric(10, 4),
	"ebitda_growth_yoy" numeric(10, 4),
	"book_value_growth_yoy" numeric(10, 4),
	"ocf_growth_yoy" numeric(10, 4),
	"fcf_growth_yoy" numeric(10, 4),
	"revenue_cagr_3y" numeric(10, 4),
	"revenue_cagr_5y" numeric(10, 4),
	"eps_cagr_3y" numeric(10, 4),
	"eps_cagr_5y" numeric(10, 4),
	"pat_cagr_3y" numeric(10, 4),
	"pat_cagr_5y" numeric(10, 4),
	"debt_to_equity" numeric(10, 4),
	"debt_to_assets" numeric(10, 4),
	"interest_coverage" numeric(12, 4),
	"current_ratio" numeric(10, 4),
	"quick_ratio" numeric(10, 4),
	"cash_ratio" numeric(10, 4),
	"net_debt" numeric(20, 2),
	"net_debt_to_ebitda" numeric(10, 4),
	"asset_turnover" numeric(10, 4),
	"inventory_turnover" numeric(10, 4),
	"receivables_turnover" numeric(10, 4),
	"payables_turnover" numeric(10, 4),
	"inventory_days" numeric(10, 2),
	"receivable_days" numeric(10, 2),
	"payable_days" numeric(10, 2),
	"cash_conversion_cycle" numeric(10, 2),
	"working_capital_turnover" numeric(10, 4),
	"piotroski_f_score" integer,
	"altman_z_score" numeric(10, 4),
	"beneish_m_score" numeric(10, 4),
	"accrual_ratio" numeric(10, 4),
	"earnings_quality" numeric(10, 4),
	"dividend_yield" numeric(10, 4),
	"dividend_payout_ratio" numeric(10, 4),
	"dividend_cover_ratio" numeric(10, 4),
	"dividend_growth_rate" numeric(10, 4),
	"dividend_streak" integer,
	"revenue" numeric(20, 2),
	"ebitda" numeric(20, 2),
	"ebit" numeric(20, 2),
	"net_income" numeric(20, 2),
	"eps" numeric(15, 4),
	"book_value_per_share" numeric(15, 4),
	"free_cash_flow" numeric(20, 2),
	"operating_cash_flow" numeric(20, 2),
	"total_assets" numeric(20, 2),
	"total_liabilities" numeric(20, 2),
	"total_equity" numeric(20, 2),
	"total_debt" numeric(20, 2),
	"cash" numeric(20, 2),
	"market_cap" numeric(20, 2),
	"shares_outstanding" numeric(15, 0),
	"eps_estimate_next_year" numeric(15, 4),
	"revenue_estimate_next_year" numeric(20, 2),
	"target_price_consensus" numeric(15, 2),
	"number_of_analysts" integer,
	"data_source" varchar(50),
	"data_quality" varchar(20),
	"calculated_at" timestamp DEFAULT now(),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stock_financial_ratios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"company_name" text,
	"sector" varchar,
	"industry" varchar,
	"market_cap_category" varchar,
	"pe_ratio" numeric(10, 2),
	"pb_ratio" numeric(10, 2),
	"ev_to_ebitda" numeric(10, 2),
	"price_to_sales" numeric(10, 2),
	"sector_avg_pe" numeric(10, 2),
	"pe_vs_sector" numeric(8, 2),
	"roe" numeric(8, 2),
	"roce" numeric(8, 2),
	"net_profit_margin" numeric(8, 2),
	"operating_margin" numeric(8, 2),
	"debt_to_equity" numeric(10, 2),
	"current_ratio" numeric(8, 2),
	"quick_ratio" numeric(8, 2),
	"interest_coverage" numeric(10, 2),
	"eps" numeric(15, 2),
	"book_value" numeric(15, 2),
	"dividend_yield" numeric(8, 4),
	"current_price" numeric(15, 2),
	"week_high_52" numeric(15, 2),
	"week_low_52" numeric(15, 2),
	"returns_1m" numeric(8, 4),
	"returns_3m" numeric(8, 4),
	"returns_1y" numeric(8, 4),
	"returns_3y" numeric(8, 4),
	"beta" numeric(6, 4),
	"volatility" numeric(8, 4),
	"ai_signal" varchar DEFAULT 'hold',
	"ai_confidence" numeric(5, 2),
	"ai_rationale" text,
	"target_price" numeric(15, 2),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "stock_financial_ratios_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "stock_prices_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"name" text NOT NULL,
	"exchange" varchar DEFAULT 'NSE' NOT NULL,
	"current_price" numeric(15, 2) NOT NULL,
	"previous_close" numeric(15, 2),
	"change" numeric(15, 2),
	"change_percent" numeric(10, 4),
	"day_high" numeric(15, 2),
	"day_low" numeric(15, 2),
	"open_price" numeric(15, 2),
	"volume" bigint,
	"market_cap" numeric(20, 2),
	"is_gainer" boolean DEFAULT false,
	"is_loser" boolean DEFAULT false,
	"gainer_rank" integer,
	"loser_rank" integer,
	"data_source" varchar DEFAULT 'nse',
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_prices_cache_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "store_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" varchar NOT NULL,
	"admin_email" varchar,
	"action" varchar NOT NULL,
	"target_type" varchar NOT NULL,
	"target_id" varchar NOT NULL,
	"target_name" varchar,
	"before_value" jsonb,
	"after_value" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "store_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"slug" varchar NOT NULL,
	"icon" varchar,
	"parent_category_id" varchar,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"is_enabled" boolean DEFAULT true,
	"coming_soon_message" text,
	"coming_soon_expected_date" date,
	"direct_funds_enabled" boolean DEFAULT false,
	"requires_advisory_subscription" boolean DEFAULT true,
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
CREATE TABLE "store_product_inquiries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar,
	"subcategory_id" varchar,
	"category_id" varchar,
	"user_id" varchar,
	"name" varchar,
	"email" varchar,
	"phone" varchar,
	"message" text,
	"inquiry_type" varchar DEFAULT 'callback',
	"status" varchar DEFAULT 'pending',
	"assigned_to" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
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
	"subcategory_id" varchar,
	"product_type" varchar NOT NULL,
	"product_key" varchar,
	"plan_type" varchar,
	"expense_ratio" numeric(5, 4),
	"trail_commission" numeric(5, 4),
	"exit_load" numeric(5, 2),
	"exit_load_period" integer,
	"amfi_code" varchar,
	"isin_code" varchar,
	"scheme_code" varchar,
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
	"visible_to_clients" boolean DEFAULT true,
	"visible_to_partners" boolean DEFAULT true,
	"visible_to_agents" boolean DEFAULT true,
	"visible_to_guests" boolean DEFAULT true,
	"show_inquiry_form" boolean DEFAULT true,
	"inquiry_message" text,
	"source_company_id" varchar,
	"lot_size" integer,
	"face_value" numeric(10, 2),
	"market_cap" numeric(20, 2),
	"pe_ratio" numeric(10, 2),
	"buy_price" numeric(15, 2),
	"sell_price" numeric(15, 2),
	"price_source" varchar,
	"price_updated_at" timestamp,
	"price_metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "store_subcategories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"description" text,
	"icon" varchar,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "store_transaction_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" varchar NOT NULL,
	"transaction_type" varchar NOT NULL,
	"user_id" varchar,
	"user_email" varchar,
	"user_name" varchar,
	"user_pan" varchar,
	"product_category" varchar NOT NULL,
	"category_id" varchar,
	"product_id" varchar,
	"product_name" varchar,
	"product_isin" varchar,
	"amount" numeric(15, 2),
	"quantity" integer,
	"unit_price" numeric(15, 2),
	"currency" varchar DEFAULT 'INR',
	"source" varchar NOT NULL,
	"source_proposal_id" varchar,
	"source_agent_id" varchar,
	"source_partner_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"status_reason" text,
	"commission_amount" numeric(15, 2),
	"commission_type" varchar,
	"commission_agent_id" varchar,
	"commission_partner_id" varchar,
	"zoho_invoice_id" varchar,
	"zoho_bill_id" varchar,
	"zoho_sync_status" varchar DEFAULT 'pending',
	"zoho_synced_at" timestamp,
	"zoho_sync_error" text,
	"regulatory_type" varchar,
	"consent_timestamp" timestamp,
	"consent_ip_address" varchar,
	"consent_checksum" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"device_fingerprint" varchar,
	"session_id" varchar,
	"checksum" varchar,
	"previous_checksum" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"metadata" jsonb,
	CONSTRAINT "store_transaction_logs_transaction_id_unique" UNIQUE("transaction_id")
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
CREATE TABLE "suitability_acknowledgements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"advisor_id" varchar,
	"client_risk_profile" varchar NOT NULL,
	"scheme_risk_level" varchar NOT NULL,
	"risk_mismatch" boolean DEFAULT true,
	"acknowledgement_text" text NOT NULL,
	"signature_type" varchar DEFAULT 'checkbox',
	"signature_reference" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"acknowledged_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suitability_checks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar,
	"client_id" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"check_type" varchar NOT NULL,
	"client_category" varchar,
	"risk_profile" varchar,
	"time_horizon_years" integer,
	"investable_amount" numeric(15, 2),
	"existing_portfolio_value" numeric(15, 2),
	"overall_suitability_score" integer,
	"suitability_passed" boolean NOT NULL,
	"suitability_reason" text,
	"risk_tolerance_check" jsonb,
	"time_horizon_check" jsonb,
	"liquidity_need_check" jsonb,
	"concentration_check" jsonb,
	"product_eligibility_check" jsonb,
	"regulatory_compliance_check" jsonb,
	"red_flags" jsonb DEFAULT '[]'::jsonb,
	"warnings_generated" jsonb DEFAULT '[]'::jsonb,
	"engine_version" varchar,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT now()
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
CREATE TABLE "support_step_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"step_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_type" varchar NOT NULL,
	"sender_name" varchar NOT NULL,
	"comment" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"is_internal" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "support_steps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"template_id" varchar,
	"step_number" integer NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"status" varchar DEFAULT 'pending',
	"completed_by" varchar,
	"completed_at" timestamp,
	"notes" text,
	"documents" jsonb DEFAULT '[]'::jsonb,
	"checklist_items" jsonb DEFAULT '[]'::jsonb,
	"started_at" timestamp,
	"estimated_time" integer,
	"actual_time" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "support_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"category" varchar NOT NULL,
	"service_type" varchar NOT NULL,
	"estimated_duration" integer,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required_documents" jsonb DEFAULT '[]'::jsonb,
	"checklist" jsonb DEFAULT '[]'::jsonb,
	"base_fee" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
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
CREATE TABLE "system_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar NOT NULL,
	"value" text NOT NULL,
	"category" varchar NOT NULL,
	"description" text,
	"is_encrypted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_configs_key_unique" UNIQUE("key")
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
CREATE TABLE "theme_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"theme_mode" varchar(20) DEFAULT 'system',
	"auto_switch_enabled" boolean DEFAULT false,
	"light_mode_start" varchar(5) DEFAULT '07:00',
	"dark_mode_start" varchar(5) DEFAULT '19:00',
	"reduced_motion" boolean DEFAULT false,
	"high_contrast" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "theme_preferences_user_id_unique" UNIQUE("user_id")
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
	"transaction_id" varchar,
	"analysis_type" varchar,
	"category" varchar,
	"insights" jsonb,
	"patterns" jsonb,
	"recommendations" jsonb,
	"confidence_score" integer,
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
CREATE TABLE "treasury_allocations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandate_id" varchar NOT NULL,
	"bucket_type" varchar NOT NULL,
	"bucket_name" varchar NOT NULL,
	"allocated_amount" numeric(20, 2) NOT NULL,
	"current_value" numeric(20, 2) NOT NULL,
	"target_yield" numeric(5, 2),
	"max_duration" integer,
	"liquidity_days" integer,
	"allowed_instruments" jsonb,
	"holdings_summary" jsonb,
	"expected_annualised_yield" numeric(5, 2),
	"actual_yield_mtd" numeric(5, 2),
	"actual_yield_ytd" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treasury_mandates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"entity_name" varchar NOT NULL,
	"capital_protection" boolean DEFAULT true,
	"liquidity_management" boolean DEFAULT false,
	"yield_enhancement" boolean DEFAULT false,
	"liability_matching" boolean DEFAULT false,
	"total_cash_available" numeric(20, 2) NOT NULL,
	"cash_deployed" numeric(20, 2) DEFAULT '0',
	"liquidity_available_t0" numeric(20, 2) DEFAULT '0',
	"liquidity_available_t1" numeric(20, 2) DEFAULT '0',
	"max_credit_risk" varchar DEFAULT 'AAA',
	"max_duration_days" integer DEFAULT 365,
	"max_single_counterparty" numeric(5, 2) DEFAULT '10',
	"maker_checker_enabled" boolean DEFAULT true,
	"authorized_signatories" jsonb,
	"board_resolution_uploaded" boolean DEFAULT false,
	"board_resolution_url" text,
	"status" varchar DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treasury_proposals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandate_id" varchar NOT NULL,
	"proposal_number" varchar NOT NULL,
	"proposal_type" varchar NOT NULL,
	"current_idle_cash" numeric(20, 2) NOT NULL,
	"current_yield" numeric(5, 2),
	"recommended_allocation" jsonb,
	"expected_total_yield" numeric(5, 2),
	"liquidity_timeline" jsonb,
	"risk_notes" text,
	"credit_profile_summary" text,
	"worst_case_nav_impact_bps" integer,
	"status" varchar DEFAULT 'draft',
	"maker_user_id" varchar,
	"checker_user_id" varchar,
	"maker_approved_at" timestamp,
	"checker_approved_at" timestamp,
	"rejection_reason" text,
	"executed_at" timestamp,
	"execution_details" jsonb,
	"valid_until" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trending_investments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_type" varchar(30) NOT NULL,
	"symbol" varchar(30) NOT NULL,
	"name" varchar(255) NOT NULL,
	"trend_score" numeric(10, 2) NOT NULL,
	"view_count" integer DEFAULT 0,
	"investor_count" integer DEFAULT 0,
	"volume_change" numeric(10, 2),
	"category" varchar(50),
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unified_cart_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"product_category" varchar NOT NULL,
	"store_product_id" varchar,
	"unlisted_company_id" varchar,
	"mutual_fund_scheme_code" varchar,
	"bond_isin" varchar,
	"ncd_isin" varchar,
	"ipo_id" varchar,
	"source" varchar DEFAULT 'client' NOT NULL,
	"source_user_id" varchar,
	"source_proposal_id" varchar,
	"quantity" integer DEFAULT 1,
	"amount" numeric(20, 2),
	"target_price" numeric(20, 2),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"display_name" varchar,
	"display_image_url" text,
	"status" varchar DEFAULT 'active',
	"client_approved" boolean DEFAULT false,
	"approved_at" timestamp,
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
CREATE TABLE "unlisted_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"action_type" varchar NOT NULL,
	"action_by" varchar NOT NULL,
	"previous_buy_price" numeric(20, 2),
	"previous_sell_price" numeric(20, 2),
	"new_buy_price" numeric(20, 2),
	"new_sell_price" numeric(20, 2),
	"price_change_percent" numeric(10, 2),
	"compliance_flags" jsonb DEFAULT '[]'::jsonb,
	"override_reason" text,
	"ip_address" varchar,
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "unlisted_cart" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"quantity" bigint NOT NULL,
	"max_price" numeric(20, 2) NOT NULL,
	"target_price" numeric(20, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "unlisted_companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"cin" varchar,
	"isin" varchar,
	"sector" varchar,
	"industry" varchar,
	"roc_state" varchar,
	"incorporation_date" date,
	"paid_up_capital" numeric(20, 2),
	"authorized_capital" numeric(20, 2),
	"face_value" numeric(10, 2),
	"total_shares" bigint,
	"probe42_company_id" varchar,
	"last_synced_at" timestamp,
	"identity_confidence" numeric(3, 2),
	"identity_status" varchar DEFAULT 'review',
	"probe42_raw_response" jsonb,
	"status" varchar DEFAULT 'active' NOT NULL,
	"listing_stage" varchar,
	"pricing_status" varchar DEFAULT 'draft',
	"draft_buy_price" numeric(20, 2),
	"draft_sell_price" numeric(20, 2),
	"published_buy_price" numeric(20, 2),
	"published_sell_price" numeric(20, 2),
	"price_published_at" timestamp,
	"price_published_by" varchar,
	"compliance_status" varchar DEFAULT 'pending',
	"compliance_block_reasons" jsonb DEFAULT '[]'::jsonb,
	"compliance_risk_score" integer DEFAULT 0,
	"compliance_last_checked_at" timestamp,
	"trading_suspended" boolean DEFAULT false,
	"trading_suspended_at" timestamp,
	"trading_suspended_by" varchar,
	"trading_suspended_reason" text,
	"website" varchar,
	"description" text,
	"logo" varchar,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"directors" jsonb DEFAULT '[]'::jsonb,
	"listed_peers" jsonb DEFAULT '[]'::jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unlisted_companies_cin_unique" UNIQUE("cin")
);
--> statement-breakpoint
CREATE TABLE "unlisted_company_status_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"previous_status" varchar(50),
	"new_status" varchar(50) NOT NULL,
	"status_source" varchar(50) NOT NULL,
	"listing_date" timestamp,
	"exchange_symbol" varchar(20),
	"exchange_name" varchar(10),
	"trading_suspended_at" timestamp,
	"suspension_reason" text,
	"admin_user_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unlisted_deals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sell_listing_id" varchar NOT NULL,
	"buy_request_id" varchar NOT NULL,
	"company_id" varchar NOT NULL,
	"seller_user_id" varchar NOT NULL,
	"buyer_user_id" varchar NOT NULL,
	"quantity" bigint NOT NULL,
	"agreed_price" numeric(20, 2) NOT NULL,
	"total_value" numeric(20, 2) NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"buyer_accepted" boolean DEFAULT false,
	"buyer_accepted_at" timestamp,
	"seller_accepted" boolean DEFAULT false,
	"seller_accepted_at" timestamp,
	"acceptance_deadline" timestamp,
	"escrow_id" varchar,
	"escrowed_at" timestamp,
	"payment_completed_at" timestamp,
	"shares_transferred_at" timestamp,
	"platform_fee" numeric(20, 2),
	"seller_fee" numeric(20, 2),
	"buyer_fee" numeric(20, 2),
	"seller_payout" numeric(20, 2),
	"buyer_charge" numeric(20, 2),
	"settlement_date" timestamp,
	"compliance_checked" boolean DEFAULT false,
	"compliance_notes" text,
	"market_type" varchar,
	"inventory_sale" boolean DEFAULT false,
	"purchase_cost" numeric(20, 2),
	"total_purchase_cost" numeric(20, 2),
	"inventory_item_id" varchar,
	"profit_margin" numeric(20, 2),
	"escrow_managed" boolean DEFAULT false,
	"deal_type" varchar,
	"buyer_name" varchar,
	"seller_name" varchar,
	"company_name" varchar,
	"price_per_share" numeric(20, 2),
	"brokerage_fee" numeric(20, 2),
	"brokerage_rate" numeric(8, 4),
	"zoho_invoice_id" varchar,
	"zoho_bill_id" varchar,
	"zoho_expense_id" varchar,
	"zoho_synced_at" timestamp,
	"zoho_sync_status" varchar(50),
	"matched_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "unlisted_escrow_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar NOT NULL,
	"request_type" varchar NOT NULL,
	"requested_amount" numeric(20, 2) NOT NULL,
	"seller_payout" numeric(20, 2),
	"platform_fee" numeric(20, 2),
	"maker_user_id" varchar NOT NULL,
	"maker_name" varchar,
	"maker_approved_at" timestamp DEFAULT now() NOT NULL,
	"maker_notes" text,
	"maker_verification_documents" jsonb DEFAULT '[]'::jsonb,
	"checker_user_id" varchar,
	"checker_name" varchar,
	"checker_approved_at" timestamp,
	"checker_notes" text,
	"checker_action" varchar,
	"status" varchar DEFAULT 'pending_checker' NOT NULL,
	"expires_at" timestamp,
	"transfer_confirmation_id" varchar,
	"dis_slip_verified" boolean DEFAULT false,
	"share_transfer_verified" boolean DEFAULT false,
	"compliance_checks" jsonb DEFAULT '[]'::jsonb,
	"rejection_reason" text,
	"rejected_by" varchar,
	"rejected_at" timestamp,
	"executed_at" timestamp,
	"execution_result" jsonb,
	"ip_address_maker" varchar,
	"ip_address_checker" varchar,
	"user_agent_maker" text,
	"user_agent_checker" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "unlisted_investor_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"financial_year" varchar(10) NOT NULL,
	"user_id" varchar NOT NULL,
	"user_pan" varchar(10),
	"first_transaction_date" timestamp NOT NULL,
	"last_transaction_date" timestamp,
	"total_investment_value" numeric(20, 2) DEFAULT '0',
	"total_shares_acquired" integer DEFAULT 0,
	"is_private_placement" boolean DEFAULT false,
	"source_of_funds_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unlisted_price_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"price" numeric(20, 2) NOT NULL,
	"volume" bigint,
	"source_type" varchar NOT NULL,
	"source_deal_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "unlisted_regulatory_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"user_email" varchar,
	"user_name" varchar,
	"user_role" varchar,
	"user_kyc_tier" varchar,
	"user_pan" varchar,
	"action" varchar NOT NULL,
	"action_category" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"company_id" varchar,
	"company_cin" varchar,
	"company_name" varchar,
	"deal_id" varchar,
	"counterparty_user_id" varchar,
	"counterparty_pan" varchar,
	"quantity" bigint,
	"price_per_share" numeric(20, 2),
	"total_value" numeric(20, 2),
	"platform_fee" numeric(20, 2),
	"gst_amount" numeric(20, 2),
	"escrow_amount" numeric(20, 2),
	"before_state" jsonb,
	"after_state" jsonb,
	"change_description" text,
	"compliance_related" boolean DEFAULT false,
	"compliance_flags" jsonb DEFAULT '[]'::jsonb,
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
	"document_ids" jsonb DEFAULT '[]'::jsonb,
	"timestamp" timestamp DEFAULT now(),
	"retention_expires_at" timestamp,
	"archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "unlisted_risk_disclosure_acknowledgments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"company_id" varchar,
	"trade_type" varchar NOT NULL,
	"trade_entity_id" varchar,
	"trade_entity_type" varchar,
	"disclosure_version" varchar NOT NULL,
	"acknowledged_disclosure_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"all_mandatory_acknowledged" boolean DEFAULT false NOT NULL,
	"company_specific_risks_acknowledged" jsonb DEFAULT '[]'::jsonb,
	"acknowledgment_statement" text,
	"acknowledged_full_text" boolean DEFAULT false NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"acknowledged_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "unlisted_str_flags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar,
	"user_id" varchar,
	"company_id" varchar,
	"flag_type" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"transaction_amount" numeric(20, 2),
	"flag_reason" text NOT NULL,
	"detection_method" varchar(50),
	"related_transactions" jsonb,
	"str_report_id" varchar,
	"str_filed_at" timestamp,
	"str_due_date" timestamp,
	"status" varchar(30) DEFAULT 'pending',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unlisted_share_lockin" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"acquisition_date" timestamp NOT NULL,
	"lockin_end_date" timestamp NOT NULL,
	"shares_locked" integer NOT NULL,
	"shares_remaining" integer NOT NULL,
	"acquisition_type" varchar(50) NOT NULL,
	"acquisition_price" numeric(20, 2),
	"transaction_id" varchar,
	"is_active" boolean DEFAULT true,
	"release_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "us_broker_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"alpaca_account_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"lrs_used_usd" numeric(15, 2) DEFAULT '0',
	"lrs_financial_year" varchar,
	"fema_eligible" boolean DEFAULT false,
	"risk_profile_completed" boolean DEFAULT false,
	"w8ben_submitted" boolean DEFAULT false,
	"fatca_compliant" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"last_sync_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "us_consents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"order_id" varchar,
	"consent_type" varchar(50) NOT NULL,
	"consent_hash" varchar(128) NOT NULL,
	"consent_data" jsonb NOT NULL,
	"verification_method" varchar(50),
	"verification_ref" varchar,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "us_feature_flags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flag_name" varchar(100) NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" varchar,
	CONSTRAINT "us_feature_flags_flag_name_unique" UNIQUE("flag_name")
);
--> statement-breakpoint
CREATE TABLE "us_holdings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"broker_account_id" varchar,
	"symbol" varchar(10) NOT NULL,
	"asset_type" varchar(20) DEFAULT 'stock',
	"quantity" numeric(15, 6) NOT NULL,
	"avg_price_usd" numeric(15, 4) NOT NULL,
	"current_price_usd" numeric(15, 4),
	"market_value_usd" numeric(15, 2),
	"unrealized_pl_usd" numeric(15, 2),
	"unrealized_pl_percent" numeric(8, 4),
	"fx_rate_at_buy" numeric(10, 4),
	"current_fx_rate" numeric(10, 4),
	"market_value_inr" numeric(15, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"last_sync_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "us_lrs_declarations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"financial_year" varchar(10) NOT NULL,
	"purpose_code" varchar(20) DEFAULT 'S0001',
	"amount_usd" numeric(15, 2) NOT NULL,
	"declaration_text" text NOT NULL,
	"declaration_hash" varchar(128) NOT NULL,
	"declared_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "us_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"broker_account_id" varchar,
	"recommendation_id" varchar,
	"symbol" varchar(10) NOT NULL,
	"side" varchar(10) NOT NULL,
	"order_type" varchar(20) DEFAULT 'market' NOT NULL,
	"time_in_force" varchar(10) DEFAULT 'day' NOT NULL,
	"quantity" numeric(15, 6),
	"notional_usd" numeric(15, 2),
	"limit_price" numeric(15, 4),
	"stop_price" numeric(15, 4),
	"filled_quantity" numeric(15, 6) DEFAULT '0',
	"avg_fill_price" numeric(15, 4),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"alpaca_order_id" varchar,
	"alpaca_client_order_id" varchar,
	"fx_rate_usd_inr" numeric(10, 4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp,
	"filled_at" timestamp,
	"cancelled_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "us_watchlist" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"notes" text
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
	"period" varchar NOT NULL,
	"currency" varchar DEFAULT 'INR' NOT NULL,
	"current_spend" numeric(15, 2) DEFAULT '0',
	"last_reset_date" timestamp DEFAULT now(),
	"ai_suggested" boolean DEFAULT false,
	"ai_reasoning" text,
	"alert_threshold" numeric(5, 2) DEFAULT '80',
	"alert_enabled" boolean DEFAULT true,
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
CREATE TABLE "user_investor_classifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"classification_type" varchar NOT NULL,
	"classification_rule_id" varchar,
	"classification_basis" varchar NOT NULL,
	"investment_amount_at_classification" numeric(18, 2),
	"net_worth_at_classification" numeric(18, 2),
	"aum_at_classification" numeric(18, 2),
	"classification_status" varchar DEFAULT 'active',
	"classified_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"verified_by" varchar,
	"verification_method" varchar,
	"verification_notes" text,
	"supporting_documents" jsonb DEFAULT '[]'::jsonb,
	"previous_classification" varchar,
	"classification_change_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_market_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"selected_market" varchar(10) DEFAULT 'IN',
	"display_currency" varchar(3) DEFAULT 'INR',
	"show_global_markets" boolean DEFAULT false,
	"preferred_markets" text[],
	"last_global_advisory_access" timestamp,
	"global_advisory_session_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_market_preferences_user_id_unique" UNIQUE("user_id")
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
	"kyc_level" varchar DEFAULT '0',
	"kyc_level_upgraded_at" timestamp,
	"bse_ucc_code" varchar,
	"bse_client_code" varchar,
	"bse_ucc_created_at" timestamp,
	"bse_ucc_status" varchar,
	"pan_verification_provider" varchar DEFAULT 'sandbox',
	"pan_verified_via_sandbox" boolean DEFAULT false,
	"pan_sandbox_verified_at" timestamp,
	"pan_sandbox_response" jsonb,
	"pan_sandbox_status" varchar,
	"ckyc_provider" varchar DEFAULT 'authbridge',
	"ckyc_fetched_via_authbridge" boolean DEFAULT false,
	"ckyc_authbridge_fetched_at" timestamp,
	"ckyc_authbridge_kin" varchar,
	"ckyc_authbridge_response" jsonb,
	"ckyc_authbridge_status" varchar,
	"kra_provider" varchar DEFAULT 'protean',
	"kra_verified_via_protean" boolean DEFAULT false,
	"kra_protean_verified_at" timestamp,
	"kra_protean_response" jsonb,
	"kra_protean_status" varchar,
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
CREATE TABLE "user_referrals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" varchar NOT NULL,
	"referral_code" varchar(20) NOT NULL,
	"referee_id" varchar,
	"referee_email" varchar(255),
	"referee_phone" varchar(20),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"referrer_reward_amount" numeric(10, 2),
	"referee_reward_amount" numeric(10, 2),
	"referrer_reward_paid_at" timestamp,
	"referee_reward_paid_at" timestamp,
	"invite_sent_at" timestamp,
	"registered_at" timestamp,
	"kyc_completed_at" timestamp,
	"first_investment_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_referrals_referral_code_unique" UNIQUE("referral_code")
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
CREATE TABLE "user_ucc_status" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"ucc_number" varchar,
	"ucc_status" varchar DEFAULT 'not_created',
	"ucc_created_date" date,
	"ucc_last_verified" timestamp,
	"nse_registered" boolean DEFAULT false,
	"bse_registered" boolean DEFAULT false,
	"mcdx_registered" boolean DEFAULT false,
	"ncdex_registered" boolean DEFAULT false,
	"trading_member_id" varchar,
	"trading_member_name" varchar,
	"clearing_member_id" varchar,
	"kra_status" varchar DEFAULT 'not_verified',
	"kra_number" varchar,
	"kra_verified_date" date,
	"kra_agency" varchar,
	"primary_demat_id" varchar,
	"demat_verified" boolean DEFAULT false,
	"fatca_compliant" boolean DEFAULT false,
	"fatca_declaration_date" date,
	"bond_trading_enabled" boolean DEFAULT false,
	"ncd_application_enabled" boolean DEFAULT false,
	"sgb_application_enabled" boolean DEFAULT false,
	"gsec_trading_enabled" boolean DEFAULT false,
	"eligibility_restrictions" jsonb DEFAULT '[]'::jsonb,
	"restriction_reasons" text,
	"last_modified_by" varchar,
	"verification_history" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_ucc_status_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_ucc_status_ucc_number_unique" UNIQUE("ucc_number")
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
	"roles" varchar[] DEFAULT ARRAY['user'],
	"is_active" boolean DEFAULT true,
	"appointment_status" varchar DEFAULT 'active',
	"appointment_initiated_by" varchar,
	"appointment_initiator_role" varchar,
	"appointment_approved_by" varchar,
	"appointment_approved_at" timestamp,
	"appointment_rejection_reason" text,
	"appointment_cost_centre_id" varchar,
	"last_login_at" timestamp,
	"previous_login_at" timestamp,
	"login_count" integer DEFAULT 0,
	"nav_position" varchar DEFAULT 'left',
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
CREATE TABLE "verification_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verification_type" varchar(50) NOT NULL,
	"identifier_hash" varchar(64) NOT NULL,
	"identifier_masked" varchar(50),
	"verified" boolean NOT NULL,
	"verification_status" varchar(50),
	"registered_name" varchar(500),
	"name_match_score" integer,
	"additional_data" jsonb DEFAULT '{}'::jsonb,
	"provider" varchar(50) NOT NULL,
	"provider_reference_id" varchar(100),
	"verified_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"requested_by" varchar,
	"request_context" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "whatsapp_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"user_id" varchar,
	"has_initiated_contact" boolean DEFAULT false NOT NULL,
	"first_contact_at" timestamp,
	"last_message_at" timestamp,
	"message_count" integer DEFAULT 0 NOT NULL,
	"opted_out" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "whatsapp_contacts_phone_number_unique" UNIQUE("phone_number")
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
	"is_default" boolean DEFAULT false,
	"is_master" boolean DEFAULT false,
	"master_agent_id" varchar,
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
	"parent_zoho_record_id" varchar,
	"owning_agent_id" varchar,
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
ALTER TABLE "a2_forms" ADD CONSTRAINT "a2_forms_transaction_id_lrs_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."lrs_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_consent_sessions" ADD CONSTRAINT "aa_consent_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_data_fetch_logs" ADD CONSTRAINT "aa_data_fetch_logs_consent_session_id_aa_consent_sessions_id_fk" FOREIGN KEY ("consent_session_id") REFERENCES "public"."aa_consent_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_data_fetch_logs" ADD CONSTRAINT "aa_data_fetch_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_raw_payloads" ADD CONSTRAINT "aa_raw_payloads_consent_session_id_aa_consent_sessions_id_fk" FOREIGN KEY ("consent_session_id") REFERENCES "public"."aa_consent_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_raw_payloads" ADD CONSTRAINT "aa_raw_payloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ab_tests" ADD CONSTRAINT "ab_tests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_category_id_achievement_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."achievement_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_investment_limit_overrides" ADD CONSTRAINT "active_investment_limit_overrides_proposal_id_investment_limit_override_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_limit_override_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_investment_limit_overrides" ADD CONSTRAINT "active_investment_limit_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_certificates" ADD CONSTRAINT "ad_certificates_transaction_id_lrs_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."lrs_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_settings" ADD CONSTRAINT "admin_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisory_sessions" ADD CONSTRAINT "advisory_sessions_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisory_sessions" ADD CONSTRAINT "advisory_sessions_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisory_sessions" ADD CONSTRAINT "advisory_sessions_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisory_subscriptions" ADD CONSTRAINT "advisory_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisory_subscriptions" ADD CONSTRAINT "advisory_subscriptions_enrolled_by_users_id_fk" FOREIGN KEY ("enrolled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_appointments" ADD CONSTRAINT "agent_appointments_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_appointments" ADD CONSTRAINT "agent_appointments_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_client_mapping_requests" ADD CONSTRAINT "agent_client_mapping_requests_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_client_mapping_requests" ADD CONSTRAINT "agent_client_mapping_requests_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_client_mapping_requests" ADD CONSTRAINT "agent_client_mapping_requests_current_agent_id_users_id_fk" FOREIGN KEY ("current_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_client_mapping_requests" ADD CONSTRAINT "agent_client_mapping_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commission_splits" ADD CONSTRAINT "agent_commission_splits_sub_agent_id_customer_care_agents_id_fk" FOREIGN KEY ("sub_agent_id") REFERENCES "public"."customer_care_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commission_splits" ADD CONSTRAINT "agent_commission_splits_master_agent_id_customer_care_agents_id_fk" FOREIGN KEY ("master_agent_id") REFERENCES "public"."customer_care_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commission_splits" ADD CONSTRAINT "agent_commission_splits_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commission_splits" ADD CONSTRAINT "agent_commission_splits_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_agent_id_customer_care_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."customer_care_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_master_agent_id_customer_care_agents_id_fk" FOREIGN KEY ("master_agent_id") REFERENCES "public"."customer_care_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_split_rule_id_agent_commission_splits_id_fk" FOREIGN KEY ("split_rule_id") REFERENCES "public"."agent_commission_splits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_compliance_audit_logs" ADD CONSTRAINT "agent_compliance_audit_logs_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_compliance_audit_logs" ADD CONSTRAINT "agent_compliance_audit_logs_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_compliance_audit_logs" ADD CONSTRAINT "agent_compliance_audit_logs_session_id_advisory_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."advisory_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_compliance_audit_logs" ADD CONSTRAINT "agent_compliance_audit_logs_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_documents" ADD CONSTRAINT "agent_documents_agent_id_customer_care_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."customer_care_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_documents" ADD CONSTRAINT "agent_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_itr_activity_log" ADD CONSTRAINT "agent_itr_activity_log_case_id_agent_itr_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."agent_itr_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_itr_activity_log" ADD CONSTRAINT "agent_itr_activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_itr_cases" ADD CONSTRAINT "agent_itr_cases_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_itr_cases" ADD CONSTRAINT "agent_itr_cases_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_itr_cases" ADD CONSTRAINT "agent_itr_cases_ca_id_users_id_fk" FOREIGN KEY ("ca_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_itr_documents" ADD CONSTRAINT "agent_itr_documents_case_id_agent_itr_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."agent_itr_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_itr_documents" ADD CONSTRAINT "agent_itr_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_leads" ADD CONSTRAINT "agent_leads_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_leads" ADD CONSTRAINT "agent_leads_converted_to_user_id_users_id_fk" FOREIGN KEY ("converted_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_partner_mappings" ADD CONSTRAINT "agent_partner_mappings_agent_id_customer_care_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."customer_care_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_partner_mappings" ADD CONSTRAINT "agent_partner_mappings_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_partner_mappings" ADD CONSTRAINT "agent_partner_mappings_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_proposal_id_ai_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."ai_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_proposal_item_id_ai_proposal_items_id_fk" FOREIGN KEY ("proposal_item_id") REFERENCES "public"."ai_proposal_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_diagnostics_id_portfolio_diagnostics_id_fk" FOREIGN KEY ("diagnostics_id") REFERENCES "public"."portfolio_diagnostics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_optimization_suggestions" ADD CONSTRAINT "ai_optimization_suggestions_session_id_tax_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tax_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_portfolio_analysis" ADD CONSTRAINT "ai_portfolio_analysis_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_portfolio_analysis" ADD CONSTRAINT "ai_portfolio_analysis_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_portfolio_analysis" ADD CONSTRAINT "ai_portfolio_analysis_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_profit_picks" ADD CONSTRAINT "ai_profit_picks_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_profit_picks" ADD CONSTRAINT "ai_profit_picks_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_profit_picks" ADD CONSTRAINT "ai_profit_picks_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposal_items" ADD CONSTRAINT "ai_proposal_items_proposal_id_ai_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."ai_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_diagnostics_id_portfolio_diagnostics_id_fk" FOREIGN KEY ("diagnostics_id") REFERENCES "public"."portfolio_diagnostics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_rationale_cache" ADD CONSTRAINT "ai_rationale_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendation_tracking" ADD CONSTRAINT "ai_recommendation_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_talking_points" ADD CONSTRAINT "ai_talking_points_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_talking_points" ADD CONSTRAINT "ai_talking_points_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_talking_points" ADD CONSTRAINT "ai_talking_points_analysis_id_ai_portfolio_analysis_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."ai_portfolio_analysis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_talking_points" ADD CONSTRAINT "ai_talking_points_profit_pick_id_ai_profit_picks_id_fk" FOREIGN KEY ("profit_pick_id") REFERENCES "public"."ai_profit_picks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_transaction_tracking" ADD CONSTRAINT "ai_transaction_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aif_master" ADD CONSTRAINT "aif_master_manager_id_fund_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."fund_managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_alert_id_user_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."user_alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amfi_verification_log" ADD CONSTRAINT "amfi_verification_log_agent_id_customer_care_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."customer_care_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amfi_verification_log" ADD CONSTRAINT "amfi_verification_log_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_integration_logs" ADD CONSTRAINT "api_integration_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_integration_logs" ADD CONSTRAINT "api_integration_logs_source_id_external_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."external_data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_tracking" ADD CONSTRAINT "api_usage_tracking_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_loan_applications_marketplace_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications_marketplace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_audit_logs" ADD CONSTRAINT "appointment_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apy_accounts" ADD CONSTRAINT "apy_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_allocation" ADD CONSTRAINT "asset_allocation_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_class_insights" ADD CONSTRAINT "asset_class_insights_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_forecasts" ADD CONSTRAINT "asset_forecasts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_forecasts" ADD CONSTRAINT "asset_forecasts_holding_id_portfolio_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."portfolio_holdings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_population_status" ADD CONSTRAINT "auto_population_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_mandates" ADD CONSTRAINT "bank_mandates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_mandates" ADD CONSTRAINT "bank_mandates_bank_account_id_user_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."user_bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbps_billers" ADD CONSTRAINT "bbps_billers_category_id_bbps_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."bbps_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbps_customer_bills" ADD CONSTRAINT "bbps_customer_bills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbps_customer_bills" ADD CONSTRAINT "bbps_customer_bills_biller_id_bbps_billers_id_fk" FOREIGN KEY ("biller_id") REFERENCES "public"."bbps_billers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbps_transactions" ADD CONSTRAINT "bbps_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbps_transactions" ADD CONSTRAINT "bbps_transactions_bill_id_bbps_customer_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bbps_customer_bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_alerts" ADD CONSTRAINT "bond_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_alerts" ADD CONSTRAINT "bond_alerts_watchlist_id_bond_watchlist_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."bond_watchlist"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_buy_requests" ADD CONSTRAINT "bond_buy_requests_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_buy_requests" ADD CONSTRAINT "bond_buy_requests_government_security_id_government_securities_id_fk" FOREIGN KEY ("government_security_id") REFERENCES "public"."government_securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_buy_requests" ADD CONSTRAINT "bond_buy_requests_corporate_bond_id_corporate_bonds_id_fk" FOREIGN KEY ("corporate_bond_id") REFERENCES "public"."corporate_bonds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_catalog" ADD CONSTRAINT "bond_catalog_fee_profile_id_bond_fee_profiles_id_fk" FOREIGN KEY ("fee_profile_id") REFERENCES "public"."bond_fee_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_catalog" ADD CONSTRAINT "bond_catalog_fee_override_id_bond_fee_overrides_id_fk" FOREIGN KEY ("fee_override_id") REFERENCES "public"."bond_fee_overrides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_catalog" ADD CONSTRAINT "bond_catalog_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_catalog" ADD CONSTRAINT "bond_catalog_unpublished_by_users_id_fk" FOREIGN KEY ("unpublished_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_catalog" ADD CONSTRAINT "bond_catalog_compliance_approved_by_users_id_fk" FOREIGN KEY ("compliance_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_catalog" ADD CONSTRAINT "bond_catalog_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_catalog" ADD CONSTRAINT "bond_catalog_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_commission_config" ADD CONSTRAINT "bond_commission_config_last_updated_by_users_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_comparison_sessions" ADD CONSTRAINT "bond_comparison_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_coupon_payments" ADD CONSTRAINT "bond_coupon_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_coupon_payments" ADD CONSTRAINT "bond_coupon_payments_holding_id_bond_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."bond_holdings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_deals" ADD CONSTRAINT "bond_deals_sell_listing_id_bond_sell_listings_id_fk" FOREIGN KEY ("sell_listing_id") REFERENCES "public"."bond_sell_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_deals" ADD CONSTRAINT "bond_deals_buy_request_id_bond_buy_requests_id_fk" FOREIGN KEY ("buy_request_id") REFERENCES "public"."bond_buy_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_deals" ADD CONSTRAINT "bond_deals_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_deals" ADD CONSTRAINT "bond_deals_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_deals" ADD CONSTRAINT "bond_deals_government_security_id_government_securities_id_fk" FOREIGN KEY ("government_security_id") REFERENCES "public"."government_securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_deals" ADD CONSTRAINT "bond_deals_corporate_bond_id_corporate_bonds_id_fk" FOREIGN KEY ("corporate_bond_id") REFERENCES "public"."corporate_bonds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_deals" ADD CONSTRAINT "bond_deals_compliance_approved_by_users_id_fk" FOREIGN KEY ("compliance_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_deals" ADD CONSTRAINT "bond_deals_matched_by_users_id_fk" FOREIGN KEY ("matched_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_fee_override_audit" ADD CONSTRAINT "bond_fee_override_audit_override_id_bond_fee_overrides_id_fk" FOREIGN KEY ("override_id") REFERENCES "public"."bond_fee_overrides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_fee_override_audit" ADD CONSTRAINT "bond_fee_override_audit_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_fee_override_audit" ADD CONSTRAINT "bond_fee_override_audit_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_fee_overrides" ADD CONSTRAINT "bond_fee_overrides_government_security_id_government_securities_id_fk" FOREIGN KEY ("government_security_id") REFERENCES "public"."government_securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_fee_overrides" ADD CONSTRAINT "bond_fee_overrides_corporate_bond_id_corporate_bonds_id_fk" FOREIGN KEY ("corporate_bond_id") REFERENCES "public"."corporate_bonds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_fee_overrides" ADD CONSTRAINT "bond_fee_overrides_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_fee_overrides" ADD CONSTRAINT "bond_fee_overrides_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_fee_profiles" ADD CONSTRAINT "bond_fee_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_fee_profiles" ADD CONSTRAINT "bond_fee_profiles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_holdings" ADD CONSTRAINT "bond_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_holdings" ADD CONSTRAINT "bond_holdings_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_marketplace_audit_logs" ADD CONSTRAINT "bond_marketplace_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_ncd_applications" ADD CONSTRAINT "bond_ncd_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_ncd_applications" ADD CONSTRAINT "bond_ncd_applications_issue_id_ncd_public_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."ncd_public_issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_orders" ADD CONSTRAINT "bond_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_risk_disclosure_acknowledgments" ADD CONSTRAINT "bond_risk_disclosure_acknowledgments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_risk_disclosure_attestations" ADD CONSTRAINT "bond_risk_disclosure_attestations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_sell_listings" ADD CONSTRAINT "bond_sell_listings_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_sell_listings" ADD CONSTRAINT "bond_sell_listings_government_security_id_government_securities_id_fk" FOREIGN KEY ("government_security_id") REFERENCES "public"."government_securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_sell_listings" ADD CONSTRAINT "bond_sell_listings_corporate_bond_id_corporate_bonds_id_fk" FOREIGN KEY ("corporate_bond_id") REFERENCES "public"."corporate_bonds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_suitability_checks" ADD CONSTRAINT "bond_suitability_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_suitability_scores" ADD CONSTRAINT "bond_suitability_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_watchlist" ADD CONSTRAINT "bond_watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buy_requests" ADD CONSTRAINT "buy_requests_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buy_requests" ADD CONSTRAINT "buy_requests_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ca_profiles" ADD CONSTRAINT "ca_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD CONSTRAINT "ca_verification_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD CONSTRAINT "ca_verification_status_icai_verified_by_users_id_fk" FOREIGN KEY ("icai_verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD CONSTRAINT "ca_verification_status_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cache_refresh_jobs" ADD CONSTRAINT "cache_refresh_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_callback_completed_by_users_id_fk" FOREIGN KEY ("callback_completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capital_gains_reports" ADD CONSTRAINT "capital_gains_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capital_gains_tax_reminders" ADD CONSTRAINT "capital_gains_tax_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capital_gains_tax_reminders" ADD CONSTRAINT "capital_gains_tax_reminders_subscription_id_tax_reminder_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."tax_reminder_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashfree_transactions" ADD CONSTRAINT "cashfree_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashfree_transactions" ADD CONSTRAINT "cashfree_transactions_cart_id_user_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."user_cart"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_actions" ADD CONSTRAINT "chat_actions_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_actions" ADD CONSTRAINT "chat_actions_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_actions" ADD CONSTRAINT "chat_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_action_logs" ADD CONSTRAINT "ckyc_action_logs_ckyc_record_id_ckyc_records_id_fk" FOREIGN KEY ("ckyc_record_id") REFERENCES "public"."ckyc_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_audit_log" ADD CONSTRAINT "ckyc_audit_log_case_id_ckyc_deferred_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."ckyc_deferred_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_audit_log" ADD CONSTRAINT "ckyc_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_audit_log" ADD CONSTRAINT "ckyc_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_audit_log" ADD CONSTRAINT "ckyc_audit_log_previous_log_id_ckyc_audit_log_id_fk" FOREIGN KEY ("previous_log_id") REFERENCES "public"."ckyc_audit_log"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_deferred_cases" ADD CONSTRAINT "ckyc_deferred_cases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_deferred_cases" ADD CONSTRAINT "ckyc_deferred_cases_assigned_to_admin_users_id_fk" FOREIGN KEY ("assigned_to_admin") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_deferred_cases" ADD CONSTRAINT "ckyc_deferred_cases_escalated_to_users_id_fk" FOREIGN KEY ("escalated_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_documents" ADD CONSTRAINT "ckyc_documents_ckyc_record_id_ckyc_records_id_fk" FOREIGN KEY ("ckyc_record_id") REFERENCES "public"."ckyc_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_escalation_history" ADD CONSTRAINT "ckyc_escalation_history_case_id_ckyc_deferred_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."ckyc_deferred_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_escalation_history" ADD CONSTRAINT "ckyc_escalation_history_escalated_to_user_id_users_id_fk" FOREIGN KEY ("escalated_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_escalation_history" ADD CONSTRAINT "ckyc_escalation_history_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_mock_blocked_attempts" ADD CONSTRAINT "ckyc_mock_blocked_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_notification_triggers" ADD CONSTRAINT "ckyc_notification_triggers_ckyc_record_id_ckyc_records_id_fk" FOREIGN KEY ("ckyc_record_id") REFERENCES "public"."ckyc_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_progress_steps" ADD CONSTRAINT "ckyc_progress_steps_ckyc_record_id_ckyc_records_id_fk" FOREIGN KEY ("ckyc_record_id") REFERENCES "public"."ckyc_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_provider_audit_log" ADD CONSTRAINT "ckyc_provider_audit_log_provider_id_ckyc_provider_config_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ckyc_provider_config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_provider_audit_log" ADD CONSTRAINT "ckyc_provider_audit_log_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_provider_config" ADD CONSTRAINT "ckyc_provider_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_records" ADD CONSTRAINT "ckyc_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_status_history" ADD CONSTRAINT "ckyc_status_history_ckyc_record_id_ckyc_records_id_fk" FOREIGN KEY ("ckyc_record_id") REFERENCES "public"."ckyc_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_verification_requests" ADD CONSTRAINT "ckyc_verification_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_agent_relationships" ADD CONSTRAINT "client_agent_relationships_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_agent_relationships" ADD CONSTRAINT "client_agent_relationships_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_agent_relationships" ADD CONSTRAINT "client_agent_relationships_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_enrichment_data" ADD CONSTRAINT "client_enrichment_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_intelligence" ADD CONSTRAINT "client_intelligence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portfolio_aif" ADD CONSTRAINT "client_portfolio_aif_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portfolio_aif" ADD CONSTRAINT "client_portfolio_aif_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portfolio_aif" ADD CONSTRAINT "client_portfolio_aif_aif_id_aif_master_id_fk" FOREIGN KEY ("aif_id") REFERENCES "public"."aif_master"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portfolio_aif" ADD CONSTRAINT "client_portfolio_aif_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portfolio_mld" ADD CONSTRAINT "client_portfolio_mld_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portfolio_mld" ADD CONSTRAINT "client_portfolio_mld_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portfolio_mld" ADD CONSTRAINT "client_portfolio_mld_mld_id_mld_master_id_fk" FOREIGN KEY ("mld_id") REFERENCES "public"."mld_master"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portfolio_mld" ADD CONSTRAINT "client_portfolio_mld_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portfolio_pms" ADD CONSTRAINT "client_portfolio_pms_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portfolio_pms" ADD CONSTRAINT "client_portfolio_pms_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portfolio_pms" ADD CONSTRAINT "client_portfolio_pms_pms_id_pms_master_id_fk" FOREIGN KEY ("pms_id") REFERENCES "public"."pms_master"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portfolio_pms" ADD CONSTRAINT "client_portfolio_pms_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_risk_profiles" ADD CONSTRAINT "client_risk_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_segments" ADD CONSTRAINT "client_segments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_statements" ADD CONSTRAINT "client_statements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collateral_valuations" ADD CONSTRAINT "collateral_valuations_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_audit_logs" ADD CONSTRAINT "commission_audit_logs_commission_plan_id_commission_plans_id_fk" FOREIGN KEY ("commission_plan_id") REFERENCES "public"."commission_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_hierarchy_splits" ADD CONSTRAINT "commission_hierarchy_splits_commission_plan_id_commission_plans_id_fk" FOREIGN KEY ("commission_plan_id") REFERENCES "public"."commission_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_commission_ledger_id_loan_commission_ledger_id_fk" FOREIGN KEY ("commission_ledger_id") REFERENCES "public"."loan_commission_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_role_maps" ADD CONSTRAINT "commission_role_maps_commission_plan_id_commission_plans_id_fk" FOREIGN KEY ("commission_plan_id") REFERENCES "public"."commission_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_external_mapping" ADD CONSTRAINT "company_external_mapping_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_external_mapping" ADD CONSTRAINT "company_external_mapping_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_external_mapping" ADD CONSTRAINT "company_external_mapping_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_financials" ADD CONSTRAINT "company_financials_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_financials_cache" ADD CONSTRAINT "company_financials_cache_company_id_company_master_cache_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company_master_cache"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_ratios" ADD CONSTRAINT "company_ratios_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparison_history" ADD CONSTRAINT "comparison_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_audit_trail" ADD CONSTRAINT "compliance_audit_trail_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compound_alerts" ADD CONSTRAINT "compound_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD CONSTRAINT "comprehensive_holdings_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD CONSTRAINT "comprehensive_holdings_snapshot_id_portfolio_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."portfolio_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD CONSTRAINT "comprehensive_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_kyc_progress" ADD CONSTRAINT "corporate_kyc_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_profiles" ADD CONSTRAINT "credit_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activity_log" ADD CONSTRAINT "crm_activity_log_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activity_log" ADD CONSTRAINT "crm_activity_log_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_client_tags" ADD CONSTRAINT "crm_client_tags_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_client_tags" ADD CONSTRAINT "crm_client_tags_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_care_agents" ADD CONSTRAINT "customer_care_agents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_reconciliation_reports" ADD CONSTRAINT "daily_reconciliation_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_reconciliation_reports" ADD CONSTRAINT "daily_reconciliation_reports_signed_off_by_users_id_fk" FOREIGN KEY ("signed_off_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_widget_preferences" ADD CONSTRAINT "dashboard_widget_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_source_consents" ADD CONSTRAINT "data_source_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digilocker_kyc_mappings" ADD CONSTRAINT "digilocker_kyc_mappings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digilocker_kyc_mappings" ADD CONSTRAINT "digilocker_kyc_mappings_digilocker_doc_id_digilocker_shared_documents_id_fk" FOREIGN KEY ("digilocker_doc_id") REFERENCES "public"."digilocker_shared_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digilocker_shared_documents" ADD CONSTRAINT "digilocker_shared_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digilocker_shared_documents" ADD CONSTRAINT "digilocker_shared_documents_app_id_digilocker_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."digilocker_apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digilocker_user_sessions" ADD CONSTRAINT "digilocker_user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digilocker_user_sessions" ADD CONSTRAINT "digilocker_user_sessions_app_id_digilocker_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."digilocker_apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_ai_reviews" ADD CONSTRAINT "document_ai_reviews_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_ai_reviews" ADD CONSTRAINT "document_ai_reviews_version_id_document_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_ai_reviews" ADD CONSTRAINT "document_ai_reviews_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_audit_events" ADD CONSTRAINT "document_audit_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_audit_events" ADD CONSTRAINT "document_audit_events_version_id_document_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_audit_events" ADD CONSTRAINT "document_audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_checklist_items" ADD CONSTRAINT "document_checklist_items_run_id_document_checklist_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."document_checklist_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_checklist_items" ADD CONSTRAINT "document_checklist_items_sebi_clause_id_sebi_clause_checklist_id_fk" FOREIGN KEY ("sebi_clause_id") REFERENCES "public"."sebi_clause_checklist"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_checklist_items" ADD CONSTRAINT "document_checklist_items_clause_id_document_clauses_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."document_clauses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_checklist_items" ADD CONSTRAINT "document_checklist_items_overridden_by_users_id_fk" FOREIGN KEY ("overridden_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_checklist_items" ADD CONSTRAINT "document_checklist_items_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_checklist_runs" ADD CONSTRAINT "document_checklist_runs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_checklist_runs" ADD CONSTRAINT "document_checklist_runs_version_id_document_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_checklist_runs" ADD CONSTRAINT "document_checklist_runs_run_by_users_id_fk" FOREIGN KEY ("run_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_checklist_runs" ADD CONSTRAINT "document_checklist_runs_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_clauses" ADD CONSTRAINT "document_clauses_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_clauses" ADD CONSTRAINT "document_clauses_version_id_document_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_version_id_document_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_clause_id_document_clauses_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."document_clauses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_tracked_change_id_document_tracked_changes_id_fk" FOREIGN KEY ("tracked_change_id") REFERENCES "public"."document_tracked_changes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_overrides" ADD CONSTRAINT "document_overrides_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_overrides" ADD CONSTRAINT "document_overrides_checklist_item_id_document_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."document_checklist_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_overrides" ADD CONSTRAINT "document_overrides_overridden_by_users_id_fk" FOREIGN KEY ("overridden_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_overrides" ADD CONSTRAINT "document_overrides_second_approval_by_users_id_fk" FOREIGN KEY ("second_approval_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_renewals" ADD CONSTRAINT "document_renewals_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_renewals" ADD CONSTRAINT "document_renewals_new_document_id_documents_id_fk" FOREIGN KEY ("new_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_version_id_document_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_signer_id_users_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tracked_changes" ADD CONSTRAINT "document_tracked_changes_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tracked_changes" ADD CONSTRAINT "document_tracked_changes_version_id_document_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tracked_changes" ADD CONSTRAINT "document_tracked_changes_clause_id_document_clauses_id_fk" FOREIGN KEY ("clause_id") REFERENCES "public"."document_clauses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tracked_changes" ADD CONSTRAINT "document_tracked_changes_suggested_by_users_id_fk" FOREIGN KEY ("suggested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tracked_changes" ADD CONSTRAINT "document_tracked_changes_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_workflow_transitions" ADD CONSTRAINT "document_workflow_transitions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_workflow_transitions" ADD CONSTRAINT "document_workflow_transitions_version_id_document_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_workflow_transitions" ADD CONSTRAINT "document_workflow_transitions_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsa_commission_tracking" ADD CONSTRAINT "dsa_commission_tracking_application_id_dsa_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."dsa_loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsa_commission_tracking" ADD CONSTRAINT "dsa_commission_tracking_bank_code_bank_connectors_bank_code_fk" FOREIGN KEY ("bank_code") REFERENCES "public"."bank_connectors"("bank_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsa_commission_tracking" ADD CONSTRAINT "dsa_commission_tracking_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD CONSTRAINT "dsa_loan_applications_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD CONSTRAINT "dsa_loan_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsa_loan_audit_logs" ADD CONSTRAINT "dsa_loan_audit_logs_application_id_dsa_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."dsa_loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsa_loan_documents" ADD CONSTRAINT "dsa_loan_documents_application_id_dsa_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."dsa_loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_funds" ADD CONSTRAINT "emergency_funds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epf_holdings" ADD CONSTRAINT "epf_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eps_holdings" ADD CONSTRAINT "eps_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_alert_history" ADD CONSTRAINT "error_alert_history_webhook_config_id_error_webhook_config_id_fk" FOREIGN KEY ("webhook_config_id") REFERENCES "public"."error_webhook_config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_alert_threshold" ADD CONSTRAINT "error_alert_threshold_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_ledger" ADD CONSTRAINT "error_ledger_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_ledger" ADD CONSTRAINT "error_ledger_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_ledger" ADD CONSTRAINT "error_ledger_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_ledger" ADD CONSTRAINT "error_ledger_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_user_feedback" ADD CONSTRAINT "error_user_feedback_error_ledger_id_error_ledger_id_fk" FOREIGN KEY ("error_ledger_id") REFERENCES "public"."error_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_user_feedback" ADD CONSTRAINT "error_user_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_user_feedback" ADD CONSTRAINT "error_user_feedback_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_webhook_config" ADD CONSTRAINT "error_webhook_config_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esign_annotation_audit_log" ADD CONSTRAINT "esign_annotation_audit_log_annotation_id_esign_document_annotations_id_fk" FOREIGN KEY ("annotation_id") REFERENCES "public"."esign_document_annotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esign_annotation_replies" ADD CONSTRAINT "esign_annotation_replies_annotation_id_esign_document_annotations_id_fk" FOREIGN KEY ("annotation_id") REFERENCES "public"."esign_document_annotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esign_certificates" ADD CONSTRAINT "esign_certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD CONSTRAINT "esign_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_filings" ADD CONSTRAINT "exchange_filings_fintekpro_company_id_unlisted_companies_id_fk" FOREIGN KEY ("fintekpro_company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_financial_audit_log" ADD CONSTRAINT "exchange_financial_audit_log_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_financial_audit_log" ADD CONSTRAINT "exchange_financial_audit_log_filing_id_exchange_filings_id_fk" FOREIGN KEY ("filing_id") REFERENCES "public"."exchange_filings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_insights" ADD CONSTRAINT "expense_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explanation_templates" ADD CONSTRAINT "explanation_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_holdings" ADD CONSTRAINT "external_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_holdings" ADD CONSTRAINT "external_holdings_cob_initiated_by_users_id_fk" FOREIGN KEY ("cob_initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_remittance_proofs" ADD CONSTRAINT "external_remittance_proofs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_remittance_proofs" ADD CONSTRAINT "external_remittance_proofs_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "fee_mode_audit_log" ADD CONSTRAINT "fee_mode_audit_log_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filing_records" ADD CONSTRAINT "filing_records_session_id_tax_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tax_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_audit_log" ADD CONSTRAINT "financial_audit_log_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_audit_log" ADD CONSTRAINT "financial_audit_log_used_by_user_id_users_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_audit_log" ADD CONSTRAINT "financial_audit_log_action_by_user_id_users_id_fk" FOREIGN KEY ("action_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_obligations" ADD CONSTRAINT "financial_obligations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_agent_commissions" ADD CONSTRAINT "fixed_income_agent_commissions_order_id_bond_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."bond_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_agent_commissions" ADD CONSTRAINT "fixed_income_agent_commissions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_agent_commissions" ADD CONSTRAINT "fixed_income_agent_commissions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_agent_commissions" ADD CONSTRAINT "fixed_income_agent_commissions_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_audit_log" ADD CONSTRAINT "fixed_income_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_notification_prefs" ADD CONSTRAINT "fixed_income_notification_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_order_payments" ADD CONSTRAINT "fixed_income_order_payments_order_id_bond_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."bond_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_order_payments" ADD CONSTRAINT "fixed_income_order_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_reports" ADD CONSTRAINT "fixed_income_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_settlements" ADD CONSTRAINT "fixed_income_settlements_order_id_bond_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."bond_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_settlements" ADD CONSTRAINT "fixed_income_settlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_15_audit_log" ADD CONSTRAINT "form_15_audit_log_case_id_form_15_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."form_15_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_15_audit_log" ADD CONSTRAINT "form_15_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_15_cases" ADD CONSTRAINT "form_15_cases_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_15_cases" ADD CONSTRAINT "form_15_cases_ca_id_users_id_fk" FOREIGN KEY ("ca_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_15_cases" ADD CONSTRAINT "form_15_cases_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_15_cases" ADD CONSTRAINT "form_15_cases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_15_cases" ADD CONSTRAINT "form_15_cases_form_15ca_everified_by_users_id_fk" FOREIGN KEY ("form_15ca_everified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_15_documents" ADD CONSTRAINT "form_15_documents_case_id_form_15_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."form_15_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_15_documents" ADD CONSTRAINT "form_15_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_15_documents" ADD CONSTRAINT "form_15_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_comparisons" ADD CONSTRAINT "fund_comparisons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_advisory_acknowledgments" ADD CONSTRAINT "global_advisory_acknowledgments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_advisory_acknowledgments" ADD CONSTRAINT "global_advisory_acknowledgments_market_code_markets_master_market_code_fk" FOREIGN KEY ("market_code") REFERENCES "public"."markets_master"("market_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" ADD CONSTRAINT "global_advisory_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" ADD CONSTRAINT "global_advisory_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" ADD CONSTRAINT "global_advisory_recommendations_instrument_id_global_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."global_instruments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_investment_client_fee_mode" ADD CONSTRAINT "global_investment_client_fee_mode_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_portfolio_positions" ADD CONSTRAINT "global_portfolio_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_portfolio_positions" ADD CONSTRAINT "global_portfolio_positions_instrument_id_global_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."global_instruments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_investment_links" ADD CONSTRAINT "goal_investment_links_goal_id_financial_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."financial_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_investment_links" ADD CONSTRAINT "goal_investment_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_milestones" ADD CONSTRAINT "goal_milestones_goal_id_financial_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."financial_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_progress_snapshots" ADD CONSTRAINT "goal_progress_snapshots_goal_id_financial_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."financial_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_scheme_audit" ADD CONSTRAINT "government_scheme_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_streams" ADD CONSTRAINT "income_streams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_holdings" ADD CONSTRAINT "insurance_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investable_surplus" ADD CONSTRAINT "investable_surplus_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_idea_alerts" ADD CONSTRAINT "investment_idea_alerts_idea_id_investment_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."investment_ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_idea_alerts" ADD CONSTRAINT "investment_idea_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_idea_tracking" ADD CONSTRAINT "investment_idea_tracking_idea_id_investment_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."investment_ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_idea_tracking" ADD CONSTRAINT "investment_idea_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_ideas" ADD CONSTRAINT "investment_ideas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_inquiries" ADD CONSTRAINT "investment_inquiries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_inquiries" ADD CONSTRAINT "investment_inquiries_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_limit_override_proposals" ADD CONSTRAINT "investment_limit_override_proposals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_limit_override_proposals" ADD CONSTRAINT "investment_limit_override_proposals_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_limit_override_proposals" ADD CONSTRAINT "investment_limit_override_proposals_level1_reviewed_by_users_id_fk" FOREIGN KEY ("level1_reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_limit_override_proposals" ADD CONSTRAINT "investment_limit_override_proposals_level2_reviewed_by_users_id_fk" FOREIGN KEY ("level2_reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_limit_override_proposals" ADD CONSTRAINT "investment_limit_override_proposals_final_approved_by_users_id_fk" FOREIGN KEY ("final_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_limit_override_proposals" ADD CONSTRAINT "investment_limit_override_proposals_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_limit_override_proposals" ADD CONSTRAINT "investment_limit_override_proposals_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "itr_pricing_config" ADD CONSTRAINT "itr_pricing_config_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itr_pricing_config" ADD CONSTRAINT "itr_pricing_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_audit_logs" ADD CONSTRAINT "knowledge_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_audit_logs" ADD CONSTRAINT "knowledge_audit_logs_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_disclaimers" ADD CONSTRAINT "knowledge_disclaimers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_hub_config" ADD CONSTRAINT "knowledge_hub_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_audit_logs" ADD CONSTRAINT "kyc_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" ADD CONSTRAINT "kyc_consent_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_form_progress" ADD CONSTRAINT "kyc_form_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_form_progress" ADD CONSTRAINT "kyc_form_progress_ckyc_record_id_ckyc_records_id_fk" FOREIGN KEY ("ckyc_record_id") REFERENCES "public"."ckyc_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_reuse_tokens" ADD CONSTRAINT "kyc_reuse_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_token_map" ADD CONSTRAINT "kyc_token_map_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_upgrade_reminders" ADD CONSTRAINT "kyc_upgrade_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_vault" ADD CONSTRAINT "kyc_vault_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verification_sessions" ADD CONSTRAINT "kyc_verification_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_prospect_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."prospect_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activity_log" ADD CONSTRAINT "lead_activity_log_lead_id_loan_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."loan_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_lessons" ADD CONSTRAINT "learning_lessons_module_id_learning_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."learning_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_quizzes" ADD CONSTRAINT "learning_quizzes_lesson_id_learning_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."learning_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_staff" ADD CONSTRAINT "lender_staff_provider_id_loan_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."loan_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_staff" ADD CONSTRAINT "lender_staff_reports_to_id_lender_staff_id_fk" FOREIGN KEY ("reports_to_id") REFERENCES "public"."lender_staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_staff_history" ADD CONSTRAINT "lender_staff_history_staff_id_lender_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."lender_staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_staff_history" ADD CONSTRAINT "lender_staff_history_previous_provider_id_loan_providers_id_fk" FOREIGN KEY ("previous_provider_id") REFERENCES "public"."loan_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_staff_history" ADD CONSTRAINT "lender_staff_history_new_provider_id_loan_providers_id_fk" FOREIGN KEY ("new_provider_id") REFERENCES "public"."loan_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_staff_history" ADD CONSTRAINT "lender_staff_history_leads_reassigned_to_lender_staff_id_fk" FOREIGN KEY ("leads_reassigned_to") REFERENCES "public"."lender_staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications_marketplace" ADD CONSTRAINT "loan_applications_marketplace_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications_marketplace" ADD CONSTRAINT "loan_applications_marketplace_loan_request_id_loan_requests_id_fk" FOREIGN KEY ("loan_request_id") REFERENCES "public"."loan_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_commission_ledger" ADD CONSTRAINT "loan_commission_ledger_application_id_loan_applications_marketplace_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications_marketplace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_commission_ledger" ADD CONSTRAINT "loan_commission_ledger_commission_config_id_provider_product_commissions_id_fk" FOREIGN KEY ("commission_config_id") REFERENCES "public"."provider_product_commissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_commission_ledger" ADD CONSTRAINT "loan_commission_ledger_provider_id_loan_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."loan_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_commission_ledger" ADD CONSTRAINT "loan_commission_ledger_product_id_loan_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."loan_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_comparison_analytics" ADD CONSTRAINT "loan_comparison_analytics_comparison_id_loan_comparisons_id_fk" FOREIGN KEY ("comparison_id") REFERENCES "public"."loan_comparisons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_comparison_analytics" ADD CONSTRAINT "loan_comparison_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_comparisons" ADD CONSTRAINT "loan_comparisons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_eligibility_rules" ADD CONSTRAINT "loan_eligibility_rules_bank_code_bank_connectors_bank_code_fk" FOREIGN KEY ("bank_code") REFERENCES "public"."bank_connectors"("bank_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_leads" ADD CONSTRAINT "loan_leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_leads" ADD CONSTRAINT "loan_leads_product_id_loan_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."loan_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_leads" ADD CONSTRAINT "loan_leads_assigned_to_staff_id_lender_staff_id_fk" FOREIGN KEY ("assigned_to_staff_id") REFERENCES "public"."lender_staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_leads" ADD CONSTRAINT "loan_leads_application_id_loan_applications_marketplace_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications_marketplace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_offers" ADD CONSTRAINT "loan_offers_request_id_loan_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."loan_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_offers" ADD CONSTRAINT "loan_offers_provider_id_loan_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."loan_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_offers" ADD CONSTRAINT "loan_offers_product_id_loan_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."loan_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_routing_history" ADD CONSTRAINT "loan_routing_history_application_id_dsa_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."dsa_loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_routing_history" ADD CONSTRAINT "loan_routing_history_bank_code_bank_connectors_bank_code_fk" FOREIGN KEY ("bank_code") REFERENCES "public"."bank_connectors"("bank_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_webhook_events" ADD CONSTRAINT "loan_webhook_events_bank_code_bank_connectors_bank_code_fk" FOREIGN KEY ("bank_code") REFERENCES "public"."bank_connectors"("bank_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_webhook_events" ADD CONSTRAINT "loan_webhook_events_application_id_dsa_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."dsa_loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_webhook_events" ADD CONSTRAINT "loan_webhook_events_routing_history_id_loan_routing_history_id_fk" FOREIGN KEY ("routing_history_id") REFERENCES "public"."loan_routing_history"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lrs_compliance_tracking" ADD CONSTRAINT "lrs_compliance_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lrs_limit_alerts" ADD CONSTRAINT "lrs_limit_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lrs_transactions" ADD CONSTRAINT "lrs_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lrs_transactions" ADD CONSTRAINT "lrs_transactions_tracking_id_lrs_compliance_tracking_id_fk" FOREIGN KEY ("tracking_id") REFERENCES "public"."lrs_compliance_tracking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_kyc_documents" ADD CONSTRAINT "manual_kyc_documents_submission_id_manual_kyc_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."manual_kyc_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_kyc_documents" ADD CONSTRAINT "manual_kyc_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_kyc_submissions" ADD CONSTRAINT "manual_kyc_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_kyc_submissions" ADD CONSTRAINT "manual_kyc_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_briefs" ADD CONSTRAINT "market_briefs_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_briefs" ADD CONSTRAINT "market_briefs_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_product_matrix" ADD CONSTRAINT "market_product_matrix_market_code_markets_master_market_code_fk" FOREIGN KEY ("market_code") REFERENCES "public"."markets_master"("market_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_product_matrix" ADD CONSTRAINT "market_product_matrix_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_product_matrix" ADD CONSTRAINT "market_product_matrix_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets_master" ADD CONSTRAINT "markets_master_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets_master" ADD CONSTRAINT "markets_master_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mca_charges" ADD CONSTRAINT "mca_charges_cin_mca_company_master_cin_fk" FOREIGN KEY ("cin") REFERENCES "public"."mca_company_master"("cin") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mca_derived_metrics" ADD CONSTRAINT "mca_derived_metrics_cin_mca_company_master_cin_fk" FOREIGN KEY ("cin") REFERENCES "public"."mca_company_master"("cin") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mca_director_company_map" ADD CONSTRAINT "mca_director_company_map_din_mca_directors_din_fk" FOREIGN KEY ("din") REFERENCES "public"."mca_directors"("din") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mca_director_company_map" ADD CONSTRAINT "mca_director_company_map_cin_mca_company_master_cin_fk" FOREIGN KEY ("cin") REFERENCES "public"."mca_company_master"("cin") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mca_financial_snapshot" ADD CONSTRAINT "mca_financial_snapshot_cin_mca_company_master_cin_fk" FOREIGN KEY ("cin") REFERENCES "public"."mca_company_master"("cin") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mca_query_log" ADD CONSTRAINT "mca_query_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mca_risk_scores" ADD CONSTRAINT "mca_risk_scores_cin_mca_company_master_cin_fk" FOREIGN KEY ("cin") REFERENCES "public"."mca_company_master"("cin") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mca_shareholding_pattern" ADD CONSTRAINT "mca_shareholding_pattern_cin_mca_company_master_cin_fk" FOREIGN KEY ("cin") REFERENCES "public"."mca_company_master"("cin") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_bookings" ADD CONSTRAINT "meeting_bookings_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_bookings" ADD CONSTRAINT "meeting_bookings_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_batch_validation_logs" ADD CONSTRAINT "mf_batch_validation_logs_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_contract_notes" ADD CONSTRAINT "mf_contract_notes_order_id_mf_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."mf_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_folios" ADD CONSTRAINT "mf_folios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_folios" ADD CONSTRAINT "mf_folios_bank_account_id_user_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."user_bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_holdings" ADD CONSTRAINT "mf_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_holdings" ADD CONSTRAINT "mf_holdings_folio_id_mf_folios_id_fk" FOREIGN KEY ("folio_id") REFERENCES "public"."mf_folios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_order_audit_log" ADD CONSTRAINT "mf_order_audit_log_order_id_mf_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."mf_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_order_audit_log" ADD CONSTRAINT "mf_order_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_orders" ADD CONSTRAINT "mf_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_orders" ADD CONSTRAINT "mf_orders_advisor_id_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_orders" ADD CONSTRAINT "mf_orders_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_orders" ADD CONSTRAINT "mf_orders_folio_id_mf_folios_id_fk" FOREIGN KEY ("folio_id") REFERENCES "public"."mf_folios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_orders" ADD CONSTRAINT "mf_orders_mandate_id_bank_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."bank_mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_orders" ADD CONSTRAINT "mf_orders_payout_bank_id_user_bank_accounts_id_fk" FOREIGN KEY ("payout_bank_id") REFERENCES "public"."user_bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_orders" ADD CONSTRAINT "mf_orders_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_reconciliation_entries" ADD CONSTRAINT "mf_reconciliation_entries_order_id_mf_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."mf_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_reconciliation_entries" ADD CONSTRAINT "mf_reconciliation_entries_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mld_monthwise_performance" ADD CONSTRAINT "mld_monthwise_performance_mld_id_mld_master_id_fk" FOREIGN KEY ("mld_id") REFERENCES "public"."mld_master"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mld_price_history" ADD CONSTRAINT "mld_price_history_mld_id_mld_master_id_fk" FOREIGN KEY ("mld_id") REFERENCES "public"."mld_master"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_accounts" ADD CONSTRAINT "nps_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nri_kyc_progress" ADD CONSTRAINT "nri_kyc_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_invitation_events" ADD CONSTRAINT "onboarding_invitation_events_invitation_id_onboarding_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."onboarding_invitations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_invitations" ADD CONSTRAINT "onboarding_invitations_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_documents" ADD CONSTRAINT "order_documents_order_id_unified_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."unified_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_documents" ADD CONSTRAINT "order_documents_signed_by_users_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_fee_consent_log" ADD CONSTRAINT "order_fee_consent_log_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lifecycle_events" ADD CONSTRAINT "order_lifecycle_events_order_id_unified_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."unified_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lifecycle_events" ADD CONSTRAINT "order_lifecycle_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_order_id_unified_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."unified_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pan_consent_audit_log" ADD CONSTRAINT "pan_consent_audit_log_consent_id_pan_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."pan_consents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pan_consent_audit_log" ADD CONSTRAINT "pan_consent_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pan_consents" ADD CONSTRAINT "pan_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "pending_appointments" ADD CONSTRAINT "pending_appointments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phonepe_transactions" ADD CONSTRAINT "phonepe_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phonepe_transactions" ADD CONSTRAINT "phonepe_transactions_cart_id_user_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."user_cart"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pi_chat_summaries" ADD CONSTRAINT "pi_chat_summaries_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_price_alerts" ADD CONSTRAINT "pick_price_alerts_pick_id_daily_picks_id_fk" FOREIGN KEY ("pick_id") REFERENCES "public"."daily_picks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_price_alerts" ADD CONSTRAINT "pick_price_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_watchlist" ADD CONSTRAINT "pick_watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_watchlist" ADD CONSTRAINT "pick_watchlist_pick_id_daily_picks_id_fk" FOREIGN KEY ("pick_id") REFERENCES "public"."daily_picks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_feature_flags" ADD CONSTRAINT "platform_feature_flags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_feature_flags" ADD CONSTRAINT "platform_feature_flags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_fee_config" ADD CONSTRAINT "platform_fee_config_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_fee_config" ADD CONSTRAINT "platform_fee_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pms_master" ADD CONSTRAINT "pms_master_manager_id_fund_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."fund_managers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_alerts" ADD CONSTRAINT "portfolio_alerts_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_alerts" ADD CONSTRAINT "portfolio_alerts_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_alerts" ADD CONSTRAINT "portfolio_alerts_holding_id_portfolio_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."portfolio_holdings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_comparisons" ADD CONSTRAINT "portfolio_comparisons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_diagnostics" ADD CONSTRAINT "portfolio_diagnostics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_generated_reports" ADD CONSTRAINT "portfolio_generated_reports_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_generated_reports" ADD CONSTRAINT "portfolio_generated_reports_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_generated_reports" ADD CONSTRAINT "portfolio_generated_reports_template_id_portfolio_report_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."portfolio_report_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_generated_reports" ADD CONSTRAINT "portfolio_generated_reports_generated_by_user_id_users_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_metrics_daily" ADD CONSTRAINT "portfolio_metrics_daily_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_metrics_daily" ADD CONSTRAINT "portfolio_metrics_daily_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_predictions" ADD CONSTRAINT "portfolio_predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_predictions" ADD CONSTRAINT "portfolio_predictions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_report_audit_logs" ADD CONSTRAINT "portfolio_report_audit_logs_report_id_portfolio_generated_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."portfolio_generated_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_report_audit_logs" ADD CONSTRAINT "portfolio_report_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_report_templates" ADD CONSTRAINT "portfolio_report_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_uploads" ADD CONSTRAINT "portfolio_uploads_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_uploads" ADD CONSTRAINT "portfolio_uploads_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_uploads" ADD CONSTRAINT "portfolio_uploads_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "probe42_sync_log" ADD CONSTRAINT "probe42_sync_log_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_account_preferences" ADD CONSTRAINT "product_account_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_account_preferences" ADD CONSTRAINT "product_account_preferences_bank_account_id_user_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."user_bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_account_preferences" ADD CONSTRAINT "product_account_preferences_demat_account_id_user_demat_accounts_id_fk" FOREIGN KEY ("demat_account_id") REFERENCES "public"."user_demat_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_applications" ADD CONSTRAINT "product_applications_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_applications" ADD CONSTRAINT "product_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_applications" ADD CONSTRAINT "product_applications_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_applications" ADD CONSTRAINT "product_applications_reviewed_by_partners_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_knowledge" ADD CONSTRAINT "product_knowledge_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_knowledge" ADD CONSTRAINT "product_knowledge_last_edited_by_users_id_fk" FOREIGN KEY ("last_edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_knowledge" ADD CONSTRAINT "product_knowledge_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_performance" ADD CONSTRAINT "product_performance_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_performance" ADD CONSTRAINT "product_performance_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_approvals" ADD CONSTRAINT "proposal_approvals_proposal_id_prospect_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."prospect_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_approvals" ADD CONSTRAINT "proposal_approvals_prospect_client_id_prospect_clients_id_fk" FOREIGN KEY ("prospect_client_id") REFERENCES "public"."prospect_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_audit_logs" ADD CONSTRAINT "proposal_esign_audit_logs_workflow_id_proposal_esign_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."proposal_esign_workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_audit_logs" ADD CONSTRAINT "proposal_esign_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_audit_logs" ADD CONSTRAINT "proposal_esign_audit_logs_participant_id_proposal_esign_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."proposal_esign_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_audit_logs" ADD CONSTRAINT "proposal_esign_audit_logs_version_id_proposal_esign_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."proposal_esign_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_comments" ADD CONSTRAINT "proposal_esign_comments_workflow_id_proposal_esign_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."proposal_esign_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_comments" ADD CONSTRAINT "proposal_esign_comments_version_id_proposal_esign_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."proposal_esign_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_comments" ADD CONSTRAINT "proposal_esign_comments_participant_id_proposal_esign_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."proposal_esign_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_comments" ADD CONSTRAINT "proposal_esign_comments_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_comments" ADD CONSTRAINT "proposal_esign_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_field_edits" ADD CONSTRAINT "proposal_esign_field_edits_workflow_id_proposal_esign_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."proposal_esign_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_field_edits" ADD CONSTRAINT "proposal_esign_field_edits_version_id_proposal_esign_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."proposal_esign_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_field_edits" ADD CONSTRAINT "proposal_esign_field_edits_participant_id_proposal_esign_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."proposal_esign_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_field_edits" ADD CONSTRAINT "proposal_esign_field_edits_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_field_edits" ADD CONSTRAINT "proposal_esign_field_edits_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_field_edits" ADD CONSTRAINT "proposal_esign_field_edits_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_participants" ADD CONSTRAINT "proposal_esign_participants_workflow_id_proposal_esign_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."proposal_esign_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_participants" ADD CONSTRAINT "proposal_esign_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_versions" ADD CONSTRAINT "proposal_esign_versions_workflow_id_proposal_esign_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."proposal_esign_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_versions" ADD CONSTRAINT "proposal_esign_versions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_versions" ADD CONSTRAINT "proposal_esign_versions_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_versions" ADD CONSTRAINT "proposal_esign_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_workflows" ADD CONSTRAINT "proposal_esign_workflows_proposal_id_prospect_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."prospect_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_esign_workflows" ADD CONSTRAINT "proposal_esign_workflows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_holdings" ADD CONSTRAINT "proposal_holdings_proposal_id_prospect_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."prospect_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_holdings" ADD CONSTRAINT "proposal_holdings_instrument_id_instrument_master_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instrument_master"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_interactions" ADD CONSTRAINT "proposal_interactions_proposal_id_prospect_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."prospect_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_materializations" ADD CONSTRAINT "proposal_materializations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_materializations" ADD CONSTRAINT "proposal_materializations_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_materializations" ADD CONSTRAINT "proposal_materializations_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_notes" ADD CONSTRAINT "proposal_notes_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_notes" ADD CONSTRAINT "proposal_notes_session_id_advisory_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."advisory_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_notes" ADD CONSTRAINT "proposal_notes_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_payments" ADD CONSTRAINT "proposal_payments_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_payments" ADD CONSTRAINT "proposal_payments_proposal_item_id_investment_proposal_items_id_fk" FOREIGN KEY ("proposal_item_id") REFERENCES "public"."investment_proposal_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_payments" ADD CONSTRAINT "proposal_payments_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_payments" ADD CONSTRAINT "proposal_payments_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_shares" ADD CONSTRAINT "proposal_shares_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_shares" ADD CONSTRAINT "proposal_shares_session_id_advisory_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."advisory_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_shares" ADD CONSTRAINT "proposal_shares_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_shares" ADD CONSTRAINT "proposal_shares_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_clients" ADD CONSTRAINT "prospect_clients_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_clients" ADD CONSTRAINT "prospect_clients_converted_user_id_users_id_fk" FOREIGN KEY ("converted_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_leads" ADD CONSTRAINT "prospect_leads_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_leads" ADD CONSTRAINT "prospect_leads_converted_to_user_id_users_id_fk" FOREIGN KEY ("converted_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_proposal_events" ADD CONSTRAINT "prospect_proposal_events_proposal_id_prospect_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."prospect_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_proposals" ADD CONSTRAINT "prospect_proposals_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_proposals" ADD CONSTRAINT "prospect_proposals_invitation_id_onboarding_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."onboarding_invitations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_proposals" ADD CONSTRAINT "prospect_proposals_converted_user_id_users_id_fk" FOREIGN KEY ("converted_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_integrations" ADD CONSTRAINT "provider_integrations_provider_id_loan_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."loan_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_product_commissions" ADD CONSTRAINT "provider_product_commissions_provider_id_loan_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."loan_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_product_commissions" ADD CONSTRAINT "provider_product_commissions_product_id_loan_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."loan_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_products" ADD CONSTRAINT "provider_products_provider_id_loan_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."loan_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_products" ADD CONSTRAINT "provider_products_product_id_loan_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."loan_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_certification_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."certification_quizzes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbi_retail_direct_accounts" ADD CONSTRAINT "rbi_retail_direct_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalance_summaries" ADD CONSTRAINT "rebalance_summaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalance_summaries" ADD CONSTRAINT "rebalance_summaries_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalance_summaries" ADD CONSTRAINT "rebalance_summaries_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_actions" ADD CONSTRAINT "rebalancing_actions_snapshot_id_rebalancing_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."rebalancing_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_actions" ADD CONSTRAINT "rebalancing_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_actions" ADD CONSTRAINT "rebalancing_actions_instrument_id_global_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."global_instruments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_recommendations" ADD CONSTRAINT "rebalancing_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_snapshots" ADD CONSTRAINT "rebalancing_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_suggestions" ADD CONSTRAINT "rebalancing_suggestions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_products" ADD CONSTRAINT "recommendation_products_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_products" ADD CONSTRAINT "recommendation_products_last_updated_by_users_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_payout_config" ADD CONSTRAINT "referral_payout_config_provider_id_loan_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."loan_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_payout_config" ADD CONSTRAINT "referral_payout_config_product_id_loan_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."loan_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_payout_transactions" ADD CONSTRAINT "referral_payout_transactions_commission_ledger_id_loan_commission_ledger_id_fk" FOREIGN KEY ("commission_ledger_id") REFERENCES "public"."loan_commission_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_payout_transactions" ADD CONSTRAINT "referral_payout_transactions_payout_config_id_referral_payout_config_id_fk" FOREIGN KEY ("payout_config_id") REFERENCES "public"."referral_payout_config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_bulletins" ADD CONSTRAINT "regulatory_bulletins_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_violation_logs" ADD CONSTRAINT "regulatory_violation_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_violation_logs" ADD CONSTRAINT "regulatory_violation_logs_override_proposal_id_investment_limit_override_proposals_id_fk" FOREIGN KEY ("override_proposal_id") REFERENCES "public"."investment_limit_override_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_violation_logs" ADD CONSTRAINT "regulatory_violation_logs_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reit_invit_holdings" ADD CONSTRAINT "reit_invit_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reit_invit_orders" ADD CONSTRAINT "reit_invit_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_access_logs" ADD CONSTRAINT "report_access_logs_report_id_generated_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."generated_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_access_logs" ADD CONSTRAINT "report_access_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_analysis" ADD CONSTRAINT "risk_analysis_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_analysis" ADD CONSTRAINT "risk_analysis_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_profiles" ADD CONSTRAINT "risk_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_profiles" ADD CONSTRAINT "risk_profiles_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheme_consents" ADD CONSTRAINT "scheme_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_ai_risk_recommendations" ADD CONSTRAINT "sebi_ai_risk_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_ai_risk_recommendations" ADD CONSTRAINT "sebi_ai_risk_recommendations_current_assessment_id_sebi_client_risk_assessments_id_fk" FOREIGN KEY ("current_assessment_id") REFERENCES "public"."sebi_client_risk_assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_ai_risk_recommendations" ADD CONSTRAINT "sebi_ai_risk_recommendations_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_ai_risk_recommendations" ADD CONSTRAINT "sebi_ai_risk_recommendations_new_assessment_id_sebi_client_risk_assessments_id_fk" FOREIGN KEY ("new_assessment_id") REFERENCES "public"."sebi_client_risk_assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_client_risk_assessments" ADD CONSTRAINT "sebi_client_risk_assessments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_client_risk_assessments" ADD CONSTRAINT "sebi_client_risk_assessments_questionnaire_version_id_sebi_questionnaire_versions_id_fk" FOREIGN KEY ("questionnaire_version_id") REFERENCES "public"."sebi_questionnaire_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_client_risk_assessments" ADD CONSTRAINT "sebi_client_risk_assessments_profile_id_sebi_risk_profiles_master_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."sebi_risk_profiles_master"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_client_risk_assessments" ADD CONSTRAINT "sebi_client_risk_assessments_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_goal_risk_profiles" ADD CONSTRAINT "sebi_goal_risk_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_goal_risk_profiles" ADD CONSTRAINT "sebi_goal_risk_profiles_profile_id_sebi_risk_profiles_master_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."sebi_risk_profiles_master"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_goal_risk_profiles" ADD CONSTRAINT "sebi_goal_risk_profiles_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_questionnaire_categories" ADD CONSTRAINT "sebi_questionnaire_categories_version_id_sebi_questionnaire_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."sebi_questionnaire_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_questionnaire_options" ADD CONSTRAINT "sebi_questionnaire_options_question_id_sebi_questionnaire_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."sebi_questionnaire_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_questionnaire_questions" ADD CONSTRAINT "sebi_questionnaire_questions_category_id_sebi_questionnaire_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."sebi_questionnaire_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_questionnaire_questions" ADD CONSTRAINT "sebi_questionnaire_questions_version_id_sebi_questionnaire_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."sebi_questionnaire_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_questionnaire_versions" ADD CONSTRAINT "sebi_questionnaire_versions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_risk_audit_logs" ADD CONSTRAINT "sebi_risk_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_risk_audit_logs" ADD CONSTRAINT "sebi_risk_audit_logs_assessment_id_sebi_client_risk_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."sebi_client_risk_assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_risk_audit_logs" ADD CONSTRAINT "sebi_risk_audit_logs_recommendation_id_sebi_ai_risk_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."sebi_ai_risk_recommendations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_risk_audit_logs" ADD CONSTRAINT "sebi_risk_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sell_listings" ADD CONSTRAINT "sell_listings_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sell_listings" ADD CONSTRAINT "sell_listings_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_kyc_progress" ADD CONSTRAINT "smart_kyc_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_shares" ADD CONSTRAINT "social_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_shares" ADD CONSTRAINT "social_shares_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stamp_duty_audit_log" ADD CONSTRAINT "stamp_duty_audit_log_payer_user_id_users_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stamp_duty_audit_log" ADD CONSTRAINT "stamp_duty_audit_log_config_snapshot_id_stamp_duty_config_id_fk" FOREIGN KEY ("config_snapshot_id") REFERENCES "public"."stamp_duty_config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stamp_duty_config" ADD CONSTRAINT "stamp_duty_config_last_updated_by_users_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_financial_metrics" ADD CONSTRAINT "stock_financial_metrics_stock_id_listed_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."listed_stocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_audit_logs" ADD CONSTRAINT "store_audit_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_images" ADD CONSTRAINT "store_product_images_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_inquiries" ADD CONSTRAINT "store_product_inquiries_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_inquiries" ADD CONSTRAINT "store_product_inquiries_subcategory_id_store_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."store_subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_inquiries" ADD CONSTRAINT "store_product_inquiries_category_id_store_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."store_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_inquiries" ADD CONSTRAINT "store_product_inquiries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_inquiries" ADD CONSTRAINT "store_product_inquiries_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_tag_mappings" ADD CONSTRAINT "store_product_tag_mappings_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_tag_mappings" ADD CONSTRAINT "store_product_tag_mappings_tag_id_store_product_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."store_product_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_category_id_store_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."store_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_source_company_id_pre_ipo_companies_id_fk" FOREIGN KEY ("source_company_id") REFERENCES "public"."pre_ipo_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_subcategories" ADD CONSTRAINT "store_subcategories_category_id_store_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."store_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_transaction_logs" ADD CONSTRAINT "store_transaction_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_transaction_logs" ADD CONSTRAINT "store_transaction_logs_category_id_store_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."store_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_transaction_logs" ADD CONSTRAINT "store_transaction_logs_source_agent_id_users_id_fk" FOREIGN KEY ("source_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_transaction_logs" ADD CONSTRAINT "store_transaction_logs_source_partner_id_users_id_fk" FOREIGN KEY ("source_partner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_transaction_logs" ADD CONSTRAINT "store_transaction_logs_commission_agent_id_users_id_fk" FOREIGN KEY ("commission_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_transaction_logs" ADD CONSTRAINT "store_transaction_logs_commission_partner_id_users_id_fk" FOREIGN KEY ("commission_partner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structured_tax_data" ADD CONSTRAINT "structured_tax_data_document_id_tax_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."tax_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structured_tax_data" ADD CONSTRAINT "structured_tax_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suitability_acknowledgements" ADD CONSTRAINT "suitability_acknowledgements_order_id_mf_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."mf_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suitability_acknowledgements" ADD CONSTRAINT "suitability_acknowledgements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suitability_acknowledgements" ADD CONSTRAINT "suitability_acknowledgements_advisor_id_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suitability_checks" ADD CONSTRAINT "suitability_checks_session_id_advisory_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."advisory_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suitability_checks" ADD CONSTRAINT "suitability_checks_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suitability_checks" ADD CONSTRAINT "suitability_checks_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_step_comments" ADD CONSTRAINT "support_step_comments_step_id_support_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."support_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_steps" ADD CONSTRAINT "support_steps_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_steps" ADD CONSTRAINT "support_steps_template_id_support_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."support_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_steps" ADD CONSTRAINT "support_steps_completed_by_partners_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_templates" ADD CONSTRAINT "support_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "theme_preferences" ADD CONSTRAINT "theme_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_alerts" ADD CONSTRAINT "transaction_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_alerts" ADD CONSTRAINT "transaction_alerts_transaction_id_ai_transaction_tracking_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ai_transaction_tracking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_alerts" ADD CONSTRAINT "transaction_alerts_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD CONSTRAINT "transaction_enrichment_analysis_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_records" ADD CONSTRAINT "transaction_records_report_id_transaction_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."transaction_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_records" ADD CONSTRAINT "transaction_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_reports" ADD CONSTRAINT "transaction_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_allocations" ADD CONSTRAINT "treasury_allocations_mandate_id_treasury_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."treasury_mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_mandates" ADD CONSTRAINT "treasury_mandates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_proposals" ADD CONSTRAINT "treasury_proposals_mandate_id_treasury_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."treasury_mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_proposals" ADD CONSTRAINT "treasury_proposals_maker_user_id_users_id_fk" FOREIGN KEY ("maker_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_proposals" ADD CONSTRAINT "treasury_proposals_checker_user_id_users_id_fk" FOREIGN KEY ("checker_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_cart_items" ADD CONSTRAINT "unified_cart_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_cart_items" ADD CONSTRAINT "unified_cart_items_store_product_id_store_products_id_fk" FOREIGN KEY ("store_product_id") REFERENCES "public"."store_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_cart_items" ADD CONSTRAINT "unified_cart_items_unlisted_company_id_unlisted_companies_id_fk" FOREIGN KEY ("unlisted_company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_cart_items" ADD CONSTRAINT "unified_cart_items_source_user_id_users_id_fk" FOREIGN KEY ("source_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_orders" ADD CONSTRAINT "unified_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_orders" ADD CONSTRAINT "unified_orders_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_orders" ADD CONSTRAINT "unified_orders_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_orders" ADD CONSTRAINT "unified_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_orders" ADD CONSTRAINT "unified_orders_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_audit_log" ADD CONSTRAINT "unlisted_audit_log_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_audit_log" ADD CONSTRAINT "unlisted_audit_log_action_by_users_id_fk" FOREIGN KEY ("action_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_cart" ADD CONSTRAINT "unlisted_cart_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_cart" ADD CONSTRAINT "unlisted_cart_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_companies" ADD CONSTRAINT "unlisted_companies_price_published_by_users_id_fk" FOREIGN KEY ("price_published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_companies" ADD CONSTRAINT "unlisted_companies_trading_suspended_by_users_id_fk" FOREIGN KEY ("trading_suspended_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_companies" ADD CONSTRAINT "unlisted_companies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_company_status_log" ADD CONSTRAINT "unlisted_company_status_log_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_company_status_log" ADD CONSTRAINT "unlisted_company_status_log_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_deals" ADD CONSTRAINT "unlisted_deals_sell_listing_id_sell_listings_id_fk" FOREIGN KEY ("sell_listing_id") REFERENCES "public"."sell_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_deals" ADD CONSTRAINT "unlisted_deals_buy_request_id_buy_requests_id_fk" FOREIGN KEY ("buy_request_id") REFERENCES "public"."buy_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_deals" ADD CONSTRAINT "unlisted_deals_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_deals" ADD CONSTRAINT "unlisted_deals_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_deals" ADD CONSTRAINT "unlisted_deals_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_escrow_approvals" ADD CONSTRAINT "unlisted_escrow_approvals_deal_id_unlisted_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."unlisted_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_escrow_approvals" ADD CONSTRAINT "unlisted_escrow_approvals_maker_user_id_users_id_fk" FOREIGN KEY ("maker_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_escrow_approvals" ADD CONSTRAINT "unlisted_escrow_approvals_checker_user_id_users_id_fk" FOREIGN KEY ("checker_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_escrow_approvals" ADD CONSTRAINT "unlisted_escrow_approvals_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_investor_tracking" ADD CONSTRAINT "unlisted_investor_tracking_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_investor_tracking" ADD CONSTRAINT "unlisted_investor_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_price_history" ADD CONSTRAINT "unlisted_price_history_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_regulatory_audit_log" ADD CONSTRAINT "unlisted_regulatory_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_regulatory_audit_log" ADD CONSTRAINT "unlisted_regulatory_audit_log_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_risk_disclosure_acknowledgments" ADD CONSTRAINT "unlisted_risk_disclosure_acknowledgments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_risk_disclosure_acknowledgments" ADD CONSTRAINT "unlisted_risk_disclosure_acknowledgments_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_str_flags" ADD CONSTRAINT "unlisted_str_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_str_flags" ADD CONSTRAINT "unlisted_str_flags_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_str_flags" ADD CONSTRAINT "unlisted_str_flags_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_share_lockin" ADD CONSTRAINT "unlisted_share_lockin_company_id_unlisted_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."unlisted_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_share_lockin" ADD CONSTRAINT "unlisted_share_lockin_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "us_broker_accounts" ADD CONSTRAINT "us_broker_accounts_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "us_consents" ADD CONSTRAINT "us_consents_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "us_consents" ADD CONSTRAINT "us_consents_order_id_us_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."us_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "us_holdings" ADD CONSTRAINT "us_holdings_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "us_holdings" ADD CONSTRAINT "us_holdings_broker_account_id_us_broker_accounts_id_fk" FOREIGN KEY ("broker_account_id") REFERENCES "public"."us_broker_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "us_lrs_declarations" ADD CONSTRAINT "us_lrs_declarations_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "us_orders" ADD CONSTRAINT "us_orders_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "us_orders" ADD CONSTRAINT "us_orders_broker_account_id_us_broker_accounts_id_fk" FOREIGN KEY ("broker_account_id") REFERENCES "public"."us_broker_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "us_watchlist" ADD CONSTRAINT "us_watchlist_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "user_investor_classifications" ADD CONSTRAINT "user_investor_classifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_investor_classifications" ADD CONSTRAINT "user_investor_classifications_classification_rule_id_investor_classification_rules_id_fk" FOREIGN KEY ("classification_rule_id") REFERENCES "public"."investor_classification_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_investor_classifications" ADD CONSTRAINT "user_investor_classifications_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_market_preferences" ADD CONSTRAINT "user_market_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_market_preferences" ADD CONSTRAINT "user_market_preferences_selected_market_markets_master_market_code_fk" FOREIGN KEY ("selected_market") REFERENCES "public"."markets_master"("market_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_module_id_learning_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."learning_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_lesson_id_learning_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."learning_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_referrals" ADD CONSTRAINT "user_referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_referrals" ADD CONSTRAINT "user_referrals_referee_id_users_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ucc_status" ADD CONSTRAINT "user_ucc_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ucc_status" ADD CONSTRAINT "user_ucc_status_primary_demat_id_user_demat_accounts_id_fk" FOREIGN KEY ("primary_demat_id") REFERENCES "public"."user_demat_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_wishlist" ADD CONSTRAINT "user_wishlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_wishlist" ADD CONSTRAINT "user_wishlist_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_session_id_tax_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tax_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_cache" ADD CONSTRAINT "verification_cache_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "idx_a2_pan" ON "a2_forms" USING btree ("applicant_pan");--> statement-breakpoint
CREATE INDEX "idx_a2_status" ON "a2_forms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_a2_transaction" ON "a2_forms" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_aa_consent_user" ON "aa_consent_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_aa_consent_handle" ON "aa_consent_sessions" USING btree ("consent_handle_id");--> statement-breakpoint
CREATE INDEX "idx_aa_consent_status" ON "aa_consent_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_aa_consent_pan" ON "aa_consent_sessions" USING btree ("pan_number");--> statement-breakpoint
CREATE INDEX "idx_aa_fetch_consent" ON "aa_data_fetch_logs" USING btree ("consent_session_id");--> statement-breakpoint
CREATE INDEX "idx_aa_fetch_user" ON "aa_data_fetch_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_aa_fetch_fiu" ON "aa_data_fetch_logs" USING btree ("fiu_name");--> statement-breakpoint
CREATE INDEX "idx_aa_fetch_status" ON "aa_data_fetch_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_aa_payload_consent" ON "aa_raw_payloads" USING btree ("consent_session_id");--> statement-breakpoint
CREATE INDEX "idx_aa_payload_user" ON "aa_raw_payloads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_aa_payload_type" ON "aa_raw_payloads" USING btree ("data_type");--> statement-breakpoint
CREATE INDEX "idx_aa_payload_fetch" ON "aa_raw_payloads" USING btree ("fetch_session_id");--> statement-breakpoint
CREATE INDEX "idx_aa_payload_expires" ON "aa_raw_payloads" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_ab_experiment_id" ON "ab_testing_experiment_state" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "idx_ab_experiment_active" ON "ab_testing_experiment_state" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_ab_metrics_experiment" ON "ab_testing_metrics" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "idx_ab_metrics_user" ON "ab_testing_metrics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ab_metrics_group" ON "ab_testing_metrics" USING btree ("assigned_group");--> statement-breakpoint
CREATE INDEX "idx_ab_tests_key" ON "ab_tests" USING btree ("test_key");--> statement-breakpoint
CREATE INDEX "idx_ab_tests_status" ON "ab_tests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_active_override_user" ON "active_investment_limit_overrides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_active_override_product" ON "active_investment_limit_overrides" USING btree ("product_category");--> statement-breakpoint
CREATE INDEX "idx_active_override_active" ON "active_investment_limit_overrides" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_adc_pan" ON "ad_certificates" USING btree ("applicant_pan");--> statement-breakpoint
CREATE INDEX "idx_adc_status" ON "ad_certificates" USING btree ("status","valid_until");--> statement-breakpoint
CREATE INDEX "idx_adc_transaction" ON "ad_certificates" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_advisory_sessions_agent" ON "advisory_sessions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_advisory_sessions_client" ON "advisory_sessions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_advisory_sessions_state" ON "advisory_sessions" USING btree ("workflow_state");--> statement-breakpoint
CREATE INDEX "idx_agent_appointments_agent" ON "agent_appointments" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_appointments_client" ON "agent_appointments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_agent_appointments_date" ON "agent_appointments" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_agent_appointments_status" ON "agent_appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agent_cert_agent" ON "agent_certifications" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_cert_type" ON "agent_certifications" USING btree ("certification_type");--> statement-breakpoint
CREATE INDEX "idx_agent_cert_status" ON "agent_certifications" USING btree ("is_certified");--> statement-breakpoint
CREATE INDEX "idx_mapping_requests_agent" ON "agent_client_mapping_requests" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_mapping_requests_client" ON "agent_client_mapping_requests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_mapping_requests_status" ON "agent_client_mapping_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mapping_requests_pan" ON "agent_client_mapping_requests" USING btree ("client_pan");--> statement-breakpoint
CREATE INDEX "idx_agent_compliance_audit_agent" ON "agent_compliance_audit_logs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_compliance_audit_client" ON "agent_compliance_audit_logs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_agent_compliance_audit_session" ON "agent_compliance_audit_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_agent_compliance_audit_proposal" ON "agent_compliance_audit_logs" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_agent_compliance_audit_action" ON "agent_compliance_audit_logs" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_agent_compliance_audit_timestamp" ON "agent_compliance_audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_agent_compliance_audit_category" ON "agent_compliance_audit_logs" USING btree ("action_category");--> statement-breakpoint
CREATE INDEX "idx_agent_compliance_doc_type" ON "agent_compliance_doc_repository" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_agent_compliance_doc_category" ON "agent_compliance_doc_repository" USING btree ("document_category");--> statement-breakpoint
CREATE INDEX "idx_agent_compliance_doc_active" ON "agent_compliance_doc_repository" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_agent_itr_activity_case" ON "agent_itr_activity_log" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "idx_agent_itr_activity_type" ON "agent_itr_activity_log" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "idx_agent_itr_cases_client" ON "agent_itr_cases" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_agent_itr_cases_agent" ON "agent_itr_cases" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_itr_cases_ca" ON "agent_itr_cases" USING btree ("ca_id");--> statement-breakpoint
CREATE INDEX "idx_agent_itr_cases_status" ON "agent_itr_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agent_itr_cases_ay" ON "agent_itr_cases" USING btree ("assessment_year");--> statement-breakpoint
CREATE INDEX "idx_agent_itr_docs_case" ON "agent_itr_documents" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "idx_agent_itr_docs_type" ON "agent_itr_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_agent_leads_agent" ON "agent_leads" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_leads_stage" ON "agent_leads" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "idx_agent_leads_created" ON "agent_leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_agent_override_agent" ON "agent_override_audit_log" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_override_client" ON "agent_override_audit_log" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_agent_override_type" ON "agent_override_audit_log" USING btree ("override_type");--> statement-breakpoint
CREATE INDEX "idx_agent_override_created" ON "agent_override_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_agent_perf_agent" ON "agent_performance_metrics" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_perf_period" ON "agent_performance_metrics" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_agent_perf_type" ON "agent_performance_metrics" USING btree ("period_type");--> statement-breakpoint
CREATE INDEX "idx_agent_score_agent" ON "agent_performance_scores" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_score_period" ON "agent_performance_scores" USING btree ("score_period","period_start");--> statement-breakpoint
CREATE INDEX "idx_portfolio_outcome_agent" ON "agent_portfolio_outcomes" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_outcome_client" ON "agent_portfolio_outcomes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_ai_audit_proposal" ON "ai_audit_logs" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_ai_audit_actor" ON "ai_audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_ai_audit_action" ON "ai_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_ai_audit_timestamp" ON "ai_audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_ai_audit_category" ON "ai_audit_logs" USING btree ("action_category");--> statement-breakpoint
CREATE INDEX "idx_ai_portfolio_analysis_client" ON "ai_portfolio_analysis" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_ai_portfolio_analysis_portfolio" ON "ai_portfolio_analysis" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_ai_portfolio_analysis_date" ON "ai_portfolio_analysis" USING btree ("analysis_date");--> statement-breakpoint
CREATE INDEX "idx_ai_profit_picks_client" ON "ai_profit_picks" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_ai_profit_picks_agent" ON "ai_profit_picks" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_ai_profit_picks_status" ON "ai_profit_picks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_profit_picks_signal" ON "ai_profit_picks" USING btree ("signal_type");--> statement-breakpoint
CREATE INDEX "idx_ai_profit_picks_horizon" ON "ai_profit_picks" USING btree ("time_horizon");--> statement-breakpoint
CREATE INDEX "idx_ai_proposal_items_proposal" ON "ai_proposal_items" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_ai_proposal_items_type" ON "ai_proposal_items" USING btree ("recommendation_type");--> statement-breakpoint
CREATE INDEX "idx_ai_proposal_items_status" ON "ai_proposal_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_proposal_items_asset_class" ON "ai_proposal_items" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "idx_ai_proposals_client" ON "ai_proposals" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_ai_proposals_agent" ON "ai_proposals" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_ai_proposals_status" ON "ai_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_proposals_number" ON "ai_proposals" USING btree ("proposal_number");--> statement-breakpoint
CREATE INDEX "idx_arc_input_hash" ON "ai_rationale_cache" USING btree ("input_hash");--> statement-breakpoint
CREATE INDEX "idx_arc_rationale_type" ON "ai_rationale_cache" USING btree ("rationale_type");--> statement-breakpoint
CREATE INDEX "idx_arc_product" ON "ai_rationale_cache" USING btree ("product_type","product_id");--> statement-breakpoint
CREATE INDEX "idx_arc_expires" ON "ai_rationale_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_arc_hash_type_unique" ON "ai_rationale_cache" USING btree ("input_hash","rationale_type");--> statement-breakpoint
CREATE INDEX "idx_ai_rec_tracking_symbol" ON "ai_recommendation_tracking" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_ai_rec_tracking_status" ON "ai_recommendation_tracking" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_rec_tracking_type" ON "ai_recommendation_tracking" USING btree ("recommendation_type");--> statement-breakpoint
CREATE INDEX "idx_ai_rec_tracking_asset" ON "ai_recommendation_tracking" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "idx_ai_rec_tracking_created" ON "ai_recommendation_tracking" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_rec_tracking_expiry" ON "ai_recommendation_tracking" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "idx_ai_talking_points_client" ON "ai_talking_points" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_ai_talking_points_agent" ON "ai_talking_points" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_ai_talking_points_type" ON "ai_talking_points" USING btree ("point_type");--> statement-breakpoint
CREATE INDEX "idx_ai_talking_points_analysis" ON "ai_talking_points" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "idx_aif_master_registration" ON "aif_master" USING btree ("registration_no");--> statement-breakpoint
CREATE INDEX "idx_aif_master_category" ON "aif_master" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_aif_master_published" ON "aif_master" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "idx_aif_master_status" ON "aif_master" USING btree ("fund_status");--> statement-breakpoint
CREATE INDEX "idx_alert_history_alert_id" ON "alert_history" USING btree ("alert_id");--> statement-breakpoint
CREATE INDEX "idx_alert_history_user_id" ON "alert_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_alert_history_triggered" ON "alert_history" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "idx_alert_history_read" ON "alert_history" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_alert_templates_type" ON "alert_templates" USING btree ("template_type");--> statement-breakpoint
CREATE INDEX "idx_alert_templates_popular" ON "alert_templates" USING btree ("is_popular");--> statement-breakpoint
CREATE INDEX "idx_alert_templates_active" ON "alert_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_api_provider_pricing_name" ON "api_provider_pricing" USING btree ("provider_name");--> statement-breakpoint
CREATE INDEX "idx_api_usage_provider" ON "api_usage_logs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_api_usage_status" ON "api_usage_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_api_usage_feature" ON "api_usage_logs" USING btree ("feature");--> statement-breakpoint
CREATE INDEX "idx_api_usage_created" ON "api_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_aut_provider" ON "api_usage_tracking" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_aut_date" ON "api_usage_tracking" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_aut_cache" ON "api_usage_tracking" USING btree ("cache_hit");--> statement-breakpoint
CREATE INDEX "idx_appointment_audit_user_id" ON "appointment_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_appointment_audit_timestamp" ON "appointment_audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_appointment_audit_status" ON "appointment_audit_logs" USING btree ("new_status");--> statement-breakpoint
CREATE INDEX "idx_appointment_audit_admin" ON "appointment_audit_logs" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "idx_aci_class" ON "asset_class_insights" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "idx_aci_status" ON "asset_class_insights" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_aci_order" ON "asset_class_insights" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "idx_asset_forecasts_user" ON "asset_forecasts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_asset_forecasts_symbol" ON "asset_forecasts" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_asset_forecasts_holding" ON "asset_forecasts" USING btree ("holding_id");--> statement-breakpoint
CREATE INDEX "idx_asset_metadata_identifier" ON "asset_metadata_cache" USING btree ("identifier","identifier_type");--> statement-breakpoint
CREATE INDEX "idx_asset_metadata_name" ON "asset_metadata_cache" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_auto_pop_user" ON "auto_population_status" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auto_pop_workflow" ON "auto_population_status" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_auto_pop_status" ON "auto_population_status" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_auto_pop_initiated" ON "auto_population_status" USING btree ("initiated_at");--> statement-breakpoint
CREATE INDEX "idx_bank_mandates_user" ON "bank_mandates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bank_mandates_status" ON "bank_mandates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bank_mandates_umrn" ON "bank_mandates" USING btree ("umrn");--> statement-breakpoint
CREATE INDEX "idx_bond_alerts_user" ON "bond_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bond_alerts_status" ON "bond_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bond_buy_requests_buyer" ON "bond_buy_requests" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "idx_bond_buy_requests_isin" ON "bond_buy_requests" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_bond_buy_requests_status" ON "bond_buy_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bond_buy_requests_type" ON "bond_buy_requests" USING btree ("instrument_type");--> statement-breakpoint
CREATE INDEX "idx_bond_buy_requests_bond_type" ON "bond_buy_requests" USING btree ("bond_type");--> statement-breakpoint
CREATE INDEX "idx_bond_calendar_date" ON "bond_calendar_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "idx_bond_calendar_type" ON "bond_calendar_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_bond_calendar_instrument" ON "bond_calendar_events" USING btree ("instrument_type");--> statement-breakpoint
CREATE INDEX "idx_bond_calendar_status" ON "bond_calendar_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bond_calendar_source" ON "bond_calendar_events" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_bond_calendar_isin" ON "bond_calendar_events" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_bond_catalog_isin" ON "bond_catalog" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_bond_catalog_source" ON "bond_catalog" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_bond_catalog_type" ON "bond_catalog" USING btree ("instrument_type");--> statement-breakpoint
CREATE INDEX "idx_bond_catalog_status" ON "bond_catalog" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bond_catalog_listed" ON "bond_catalog" USING btree ("is_listed");--> statement-breakpoint
CREATE INDEX "idx_bond_catalog_exchange" ON "bond_catalog" USING btree ("exchange");--> statement-breakpoint
CREATE INDEX "idx_comparison_user" ON "bond_comparison_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_comparison_session" ON "bond_comparison_sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "idx_bond_coupons_user" ON "bond_coupon_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bond_coupons_holding" ON "bond_coupon_payments" USING btree ("holding_id");--> statement-breakpoint
CREATE INDEX "idx_bond_coupons_payment_date" ON "bond_coupon_payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_bond_coupons_status" ON "bond_coupon_payments" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_bond_deals_seller" ON "bond_deals" USING btree ("seller_user_id");--> statement-breakpoint
CREATE INDEX "idx_bond_deals_buyer" ON "bond_deals" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "idx_bond_deals_isin" ON "bond_deals" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_bond_deals_status" ON "bond_deals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bond_deals_matched" ON "bond_deals" USING btree ("matched_at");--> statement-breakpoint
CREATE INDEX "idx_fee_audit_override" ON "bond_fee_override_audit" USING btree ("override_id");--> statement-breakpoint
CREATE INDEX "idx_fee_audit_isin" ON "bond_fee_override_audit" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_fee_audit_action" ON "bond_fee_override_audit" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_fee_audit_date" ON "bond_fee_override_audit" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "idx_bond_override_gsec" ON "bond_fee_overrides" USING btree ("government_security_id");--> statement-breakpoint
CREATE INDEX "idx_bond_override_corp" ON "bond_fee_overrides" USING btree ("corporate_bond_id");--> statement-breakpoint
CREATE INDEX "idx_bond_override_isin" ON "bond_fee_overrides" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_bond_fee_instrument" ON "bond_fee_profiles" USING btree ("instrument_type");--> statement-breakpoint
CREATE INDEX "idx_bond_fee_active" ON "bond_fee_profiles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_bond_holdings_user_id" ON "bond_holdings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bond_holdings_portfolio_id" ON "bond_holdings" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_bond_holdings_status" ON "bond_holdings" USING btree ("holding_status");--> statement-breakpoint
CREATE INDEX "idx_bond_audit_user" ON "bond_marketplace_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bond_audit_action" ON "bond_marketplace_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_bond_audit_entity" ON "bond_marketplace_audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_bond_audit_isin" ON "bond_marketplace_audit_logs" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_bond_audit_timestamp" ON "bond_marketplace_audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_bond_metrics_bond" ON "bond_metrics" USING btree ("bond_id");--> statement-breakpoint
CREATE INDEX "idx_bond_metrics_isin" ON "bond_metrics" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_bond_metrics_fy" ON "bond_metrics" USING btree ("fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_ncd_applications_user" ON "bond_ncd_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ncd_applications_issue" ON "bond_ncd_applications" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "idx_ncd_applications_status" ON "bond_ncd_applications" USING btree ("application_status");--> statement-breakpoint
CREATE INDEX "idx_bond_orders_user_id" ON "bond_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bond_orders_status" ON "bond_orders" USING btree ("order_status");--> statement-breakpoint
CREATE INDEX "idx_bond_orders_date" ON "bond_orders" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "idx_bond_orders_inventory" ON "bond_orders" USING btree ("inventory_sale");--> statement-breakpoint
CREATE INDEX "idx_bond_disclosure_user" ON "bond_risk_disclosure_acknowledgments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bond_disclosure_category" ON "bond_risk_disclosure_acknowledgments" USING btree ("disclosure_category");--> statement-breakpoint
CREATE INDEX "idx_bond_disclosure_isin" ON "bond_risk_disclosure_acknowledgments" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_disclosure_attestation_user" ON "bond_risk_disclosure_attestations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_disclosure_attestation_order" ON "bond_risk_disclosure_attestations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_disclosure_attestation_isin" ON "bond_risk_disclosure_attestations" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_bond_sell_listings_seller" ON "bond_sell_listings" USING btree ("seller_user_id");--> statement-breakpoint
CREATE INDEX "idx_bond_sell_listings_isin" ON "bond_sell_listings" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_bond_sell_listings_status" ON "bond_sell_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bond_sell_listings_type" ON "bond_sell_listings" USING btree ("instrument_type");--> statement-breakpoint
CREATE INDEX "idx_bond_sell_listings_bond_type" ON "bond_sell_listings" USING btree ("bond_type");--> statement-breakpoint
CREATE INDEX "idx_bond_suitability_user" ON "bond_suitability_checks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bond_suitability_result" ON "bond_suitability_checks" USING btree ("suitability_result");--> statement-breakpoint
CREATE INDEX "idx_bond_suitability_valid" ON "bond_suitability_checks" USING btree ("valid_until");--> statement-breakpoint
CREATE INDEX "idx_suitability_user" ON "bond_suitability_scores" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_suitability_isin" ON "bond_suitability_scores" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_suitability_score" ON "bond_suitability_scores" USING btree ("overall_suitability_score");--> statement-breakpoint
CREATE INDEX "idx_bond_watchlist_user" ON "bond_watchlist" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bond_watchlist_isin" ON "bond_watchlist" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_bond_watchlist_active" ON "bond_watchlist" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_buy_requests_buyer" ON "buy_requests" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "idx_buy_requests_company" ON "buy_requests" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_buy_requests_status" ON "buy_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ca_profiles_user" ON "ca_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ca_profiles_membership" ON "ca_profiles" USING btree ("membership_number");--> statement-breakpoint
CREATE INDEX "idx_ca_profiles_available" ON "ca_profiles" USING btree ("is_available");--> statement-breakpoint
CREATE INDEX "idx_ca_verification_user" ON "ca_verification_status" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ca_verification_icai" ON "ca_verification_status" USING btree ("icai_membership_number");--> statement-breakpoint
CREATE INDEX "idx_ca_verification_status" ON "ca_verification_status" USING btree ("overall_status");--> statement-breakpoint
CREATE INDEX "idx_crj_status" ON "cache_refresh_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crj_job_type" ON "cache_refresh_jobs" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "idx_crj_scheduled" ON "cache_refresh_jobs" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_crj_next_run" ON "cache_refresh_jobs" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "idx_crs_type" ON "cache_refresh_schedule" USING btree ("cache_type");--> statement-breakpoint
CREATE INDEX "idx_crs_next" ON "cache_refresh_schedule" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "idx_call_logs_caller" ON "call_logs" USING btree ("caller_number");--> statement-breakpoint
CREATE INDEX "idx_call_logs_user" ON "call_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_call_logs_agent" ON "call_logs" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "idx_call_logs_callback" ON "call_logs" USING btree ("callback_status");--> statement-breakpoint
CREATE INDEX "idx_call_logs_started" ON "call_logs" USING btree ("call_started_at");--> statement-breakpoint
CREATE INDEX "idx_call_logs_unread" ON "call_logs" USING btree ("is_read","call_started_at");--> statement-breakpoint
CREATE INDEX "idx_campaign_recipient_campaign" ON "campaign_recipients" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_recipient_user" ON "campaign_recipients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_recipient_status" ON "campaign_recipients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_capital_gains_tax_reminders_user_id" ON "capital_gains_tax_reminders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_capital_gains_tax_reminders_due_date" ON "capital_gains_tax_reminders" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_capital_gains_tax_reminders_status" ON "capital_gains_tax_reminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cq_level" ON "certification_quizzes" USING btree ("certification_level");--> statement-breakpoint
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
CREATE INDEX "idx_ckyc_case_audit_case" ON "ckyc_audit_log" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "idx_ckyc_case_audit_user" ON "ckyc_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ckyc_case_audit_type" ON "ckyc_audit_log" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_ckyc_case_audit_time" ON "ckyc_audit_log" USING btree ("event_timestamp");--> statement-breakpoint
CREATE INDEX "idx_ckyc_case_audit_compliance" ON "ckyc_audit_log" USING btree ("is_compliance_event");--> statement-breakpoint
CREATE INDEX "idx_ckyc_case_audit_pan" ON "ckyc_audit_log" USING btree ("pan_number");--> statement-breakpoint
CREATE INDEX "idx_ckyc_deferred_user" ON "ckyc_deferred_cases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ckyc_deferred_pan" ON "ckyc_deferred_cases" USING btree ("pan_number");--> statement-breakpoint
CREATE INDEX "idx_ckyc_deferred_status" ON "ckyc_deferred_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ckyc_deferred_sla" ON "ckyc_deferred_cases" USING btree ("sla_deadline");--> statement-breakpoint
CREATE INDEX "idx_ckyc_deferred_breach" ON "ckyc_deferred_cases" USING btree ("sla_breach");--> statement-breakpoint
CREATE INDEX "idx_ckyc_deferred_assigned" ON "ckyc_deferred_cases" USING btree ("assigned_to_admin");--> statement-breakpoint
CREATE INDEX "idx_escalation_case" ON "ckyc_escalation_history" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "idx_escalation_level" ON "ckyc_escalation_history" USING btree ("escalation_level");--> statement-breakpoint
CREATE INDEX "idx_escalation_time" ON "ckyc_escalation_history" USING btree ("escalated_at");--> statement-breakpoint
CREATE INDEX "idx_mock_blocked_time" ON "ckyc_mock_blocked_attempts" USING btree ("attempted_at");--> statement-breakpoint
CREATE INDEX "idx_mock_blocked_user" ON "ckyc_mock_blocked_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_mock_blocked_env" ON "ckyc_mock_blocked_attempts" USING btree ("environment_mode");--> statement-breakpoint
CREATE INDEX "idx_ckyc_audit_provider" ON "ckyc_provider_audit_log" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_ckyc_audit_action" ON "ckyc_provider_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_ckyc_audit_time" ON "ckyc_provider_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ckyc_provider_code" ON "ckyc_provider_config" USING btree ("provider_code");--> statement-breakpoint
CREATE INDEX "idx_ckyc_provider_enabled" ON "ckyc_provider_config" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "idx_ckyc_provider_priority" ON "ckyc_provider_config" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_ckyc_req_user" ON "ckyc_verification_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ckyc_req_pan" ON "ckyc_verification_requests" USING btree ("pan_number");--> statement-breakpoint
CREATE INDEX "idx_ckyc_req_provider" ON "ckyc_verification_requests" USING btree ("selected_provider");--> statement-breakpoint
CREATE INDEX "idx_ckyc_req_status" ON "ckyc_verification_requests" USING btree ("response_status");--> statement-breakpoint
CREATE INDEX "idx_ckyc_req_time" ON "ckyc_verification_requests" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "idx_client_intel_user" ON "client_intelligence" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_client_intel_score" ON "client_intelligence" USING btree ("probe42_score");--> statement-breakpoint
CREATE INDEX "idx_client_intel_risk" ON "client_intelligence" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "idx_client_portfolio_aif_client" ON "client_portfolio_aif" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_portfolio_aif_aif" ON "client_portfolio_aif" USING btree ("aif_id");--> statement-breakpoint
CREATE INDEX "idx_client_portfolio_aif_status" ON "client_portfolio_aif" USING btree ("entry_status");--> statement-breakpoint
CREATE INDEX "idx_client_portfolio_mld_client" ON "client_portfolio_mld" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_portfolio_mld_mld" ON "client_portfolio_mld" USING btree ("mld_id");--> statement-breakpoint
CREATE INDEX "idx_client_portfolio_mld_isin" ON "client_portfolio_mld" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_client_portfolio_mld_status" ON "client_portfolio_mld" USING btree ("entry_status");--> statement-breakpoint
CREATE INDEX "idx_client_portfolio_pms_client" ON "client_portfolio_pms" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_portfolio_pms_pms" ON "client_portfolio_pms" USING btree ("pms_id");--> statement-breakpoint
CREATE INDEX "idx_client_portfolio_pms_status" ON "client_portfolio_pms" USING btree ("entry_status");--> statement-breakpoint
CREATE INDEX "idx_client_risk_profiles_user" ON "client_risk_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_client_risk_profiles_category" ON "client_risk_profiles" USING btree ("risk_category");--> statement-breakpoint
CREATE INDEX "idx_client_segments_user" ON "client_segments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_client_segments_segment" ON "client_segments" USING btree ("segment");--> statement-breakpoint
CREATE INDEX "idx_client_statements_user_id" ON "client_statements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_client_statements_period" ON "client_statements" USING btree ("statement_period");--> statement-breakpoint
CREATE INDEX "idx_client_statements_type" ON "client_statements" USING btree ("statement_type");--> statement-breakpoint
CREATE INDEX "commission_audit_logs_plan_id_idx" ON "commission_audit_logs" USING btree ("commission_plan_id");--> statement-breakpoint
CREATE INDEX "commission_audit_logs_changed_at_idx" ON "commission_audit_logs" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "commission_hierarchy_splits_plan_id_idx" ON "commission_hierarchy_splits" USING btree ("commission_plan_id");--> statement-breakpoint
CREATE INDEX "commission_plans_product_type_idx" ON "commission_plans" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "commission_plans_is_active_idx" ON "commission_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "commission_plans_status_idx" ON "commission_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commission_role_maps_plan_id_idx" ON "commission_role_maps" USING btree ("commission_plan_id");--> statement-breakpoint
CREATE INDEX "commission_role_maps_role_id_idx" ON "commission_role_maps" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "idx_commodities_type" ON "commodities" USING btree ("commodity_type");--> statement-breakpoint
CREATE INDEX "idx_commodities_published" ON "commodities" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "idx_company_external_mapping_company" ON "company_external_mapping" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_company_external_mapping_source" ON "company_external_mapping" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_company_external_mapping_external" ON "company_external_mapping" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "idx_company_financials_company" ON "company_financials" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_company_financials_fy" ON "company_financials" USING btree ("financial_year");--> statement-breakpoint
CREATE INDEX "idx_cfc_cin" ON "company_financials_cache" USING btree ("cin");--> statement-breakpoint
CREATE INDEX "idx_cfc_fy_q" ON "company_financials_cache" USING btree ("financial_year","quarter");--> statement-breakpoint
CREATE INDEX "idx_cfc_expires" ON "company_financials_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_cmc_cin" ON "company_master_cache" USING btree ("cin");--> statement-breakpoint
CREATE INDEX "idx_cmc_pan" ON "company_master_cache" USING btree ("pan");--> statement-breakpoint
CREATE INDEX "idx_cmc_gstin" ON "company_master_cache" USING btree ("gstin");--> statement-breakpoint
CREATE INDEX "idx_cmc_name" ON "company_master_cache" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "idx_company_ratios_company" ON "company_ratios" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_company_ratios_fy" ON "company_ratios" USING btree ("financial_year");--> statement-breakpoint
CREATE INDEX "idx_ca_user" ON "compound_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ca_symbol" ON "compound_alerts" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_crm_activity_agent" ON "crm_activity_log" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_crm_activity_client" ON "crm_activity_log" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_crm_activity_created" ON "crm_activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_crm_client_tags_agent" ON "crm_client_tags" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_crm_client_tags_client" ON "crm_client_tags" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_crm_interactions_agent" ON "crm_interactions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_crm_interactions_client" ON "crm_interactions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_crm_interactions_type" ON "crm_interactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_crm_interactions_created" ON "crm_interactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_agent" ON "crm_opportunities" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_client" ON "crm_opportunities" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_stage" ON "crm_opportunities" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_status" ON "crm_opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_tasks_agent" ON "crm_tasks" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_crm_tasks_client" ON "crm_tasks" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_crm_tasks_status" ON "crm_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_tasks_due_date" ON "crm_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_currency_rates_base_target" ON "currency_rates" USING btree ("base_currency","target_currency");--> statement-breakpoint
CREATE INDEX "idx_daily_picks_category" ON "daily_picks" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_daily_picks_status" ON "daily_picks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_daily_picks_reco_date" ON "daily_picks" USING btree ("reco_date");--> statement-breakpoint
CREATE INDEX "idx_daily_picks_isin" ON "daily_picks" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_drr_date" ON "daily_reconciliation_reports" USING btree ("report_date","product_scope");--> statement-breakpoint
CREATE INDEX "idx_drr_status" ON "daily_reconciliation_reports" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_drr_date_scope_unique" ON "daily_reconciliation_reports" USING btree ("report_date","product_scope");--> statement-breakpoint
CREATE INDEX "idx_dwp_user" ON "dashboard_widget_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_data_source_consent_user" ON "data_source_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_data_source_consent_source" ON "data_source_consents" USING btree ("data_source");--> statement-breakpoint
CREATE INDEX "idx_data_source_consent_active" ON "data_source_consents" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_data_source_consent_expires" ON "data_source_consents" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_ai_reviews_doc" ON "document_ai_reviews" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_ai_reviews_version" ON "document_ai_reviews" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "idx_ai_reviews_score" ON "document_ai_reviews" USING btree ("overall_score");--> statement-breakpoint
CREATE INDEX "idx_audit_events_doc" ON "document_audit_events" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_audit_events_actor" ON "document_audit_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_events_type" ON "document_audit_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_audit_events_hash" ON "document_audit_events" USING btree ("event_hash");--> statement-breakpoint
CREATE INDEX "idx_audit_events_time" ON "document_audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_checklist_items_run" ON "document_checklist_items" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_checklist_items_sebi" ON "document_checklist_items" USING btree ("sebi_clause_id");--> statement-breakpoint
CREATE INDEX "idx_checklist_items_status" ON "document_checklist_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_checklist_runs_doc" ON "document_checklist_runs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_checklist_runs_version" ON "document_checklist_runs" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "idx_checklist_runs_status" ON "document_checklist_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_clauses_document" ON "document_clauses" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_clauses_version" ON "document_clauses" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "idx_clauses_category" ON "document_clauses" USING btree ("clause_category");--> statement-breakpoint
CREATE INDEX "idx_clauses_sebi" ON "document_clauses" USING btree ("sebi_clause_id");--> statement-breakpoint
CREATE INDEX "idx_comments_document" ON "document_comments" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_comments_thread" ON "document_comments" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "idx_comments_author" ON "document_comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_overrides_doc" ON "document_overrides" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_overrides_actor" ON "document_overrides" USING btree ("overridden_by");--> statement-breakpoint
CREATE INDEX "idx_overrides_type" ON "document_overrides" USING btree ("override_type");--> statement-breakpoint
CREATE INDEX "idx_overrides_clause" ON "document_overrides" USING btree ("clause_code");--> statement-breakpoint
CREATE INDEX "idx_renewals_doc" ON "document_renewals" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_renewals_status" ON "document_renewals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_signatures_doc" ON "document_signatures" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_signatures_signer" ON "document_signatures" USING btree ("signer_id");--> statement-breakpoint
CREATE INDEX "idx_signatures_status" ON "document_signatures" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_signatures_ref" ON "document_signatures" USING btree ("signature_ref");--> statement-breakpoint
CREATE INDEX "idx_tracked_changes_doc" ON "document_tracked_changes" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_tracked_changes_version" ON "document_tracked_changes" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "idx_tracked_changes_status" ON "document_tracked_changes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_doc_versions_document" ON "document_versions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_doc_versions_hash" ON "document_versions" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_doc_versions_number" ON "document_versions" USING btree ("document_id","version_number");--> statement-breakpoint
CREATE INDEX "idx_workflow_transitions_doc" ON "document_workflow_transitions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_transitions_actor" ON "document_workflow_transitions" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "idx_workflow_transitions_status" ON "document_workflow_transitions" USING btree ("from_status","to_status");--> statement-breakpoint
CREATE INDEX "idx_documents_entity" ON "documents" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_documents_status" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_documents_expiry" ON "documents" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX "idx_documents_pan" ON "documents" USING btree ("entity_pan");--> statement-breakpoint
CREATE INDEX "idx_documents_agreement_type" ON "documents" USING btree ("agreement_type");--> statement-breakpoint
CREATE INDEX "idx_emergency_funds_user" ON "emergency_funds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_entity_scores_entity" ON "entity_compliance_scores" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_entity_scores_overall" ON "entity_compliance_scores" USING btree ("overall_score");--> statement-breakpoint
CREATE INDEX "idx_entity_scores_pan" ON "entity_compliance_scores" USING btree ("entity_pan");--> statement-breakpoint
CREATE INDEX "idx_error_alert_history_type" ON "error_alert_history" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "idx_error_alert_history_triggered" ON "error_alert_history" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "idx_error_ledger_severity" ON "error_ledger" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_error_ledger_status" ON "error_ledger" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_error_ledger_module" ON "error_ledger" USING btree ("module");--> statement-breakpoint
CREATE INDEX "idx_error_ledger_error_code" ON "error_ledger" USING btree ("error_code");--> statement-breakpoint
CREATE INDEX "idx_error_ledger_client" ON "error_ledger" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_error_ledger_agent" ON "error_ledger" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_error_ledger_created" ON "error_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_error_ledger_sentry" ON "error_ledger" USING btree ("sentry_event_id");--> statement-breakpoint
CREATE INDEX "idx_error_ledger_stack_hash" ON "error_ledger" USING btree ("stack_hash");--> statement-breakpoint
CREATE INDEX "idx_esign_ai_session_doc" ON "esign_ai_analysis_sessions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_esign_ai_session_status" ON "esign_ai_analysis_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_esign_annot_audit_annotation" ON "esign_annotation_audit_log" USING btree ("annotation_id");--> statement-breakpoint
CREATE INDEX "idx_esign_annot_audit_action" ON "esign_annotation_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_esign_replies_annotation" ON "esign_annotation_replies" USING btree ("annotation_id");--> statement-breakpoint
CREATE INDEX "idx_esign_replies_author" ON "esign_annotation_replies" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_esign_audit_transaction" ON "esign_audit_log" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_esign_audit_user" ON "esign_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_esign_audit_action" ON "esign_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_esign_certificates_user" ON "esign_certificates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_esign_certificates_transaction" ON "esign_certificates" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_esign_certificates_serial" ON "esign_certificates" USING btree ("certificate_serial");--> statement-breakpoint
CREATE INDEX "idx_esign_certificates_status" ON "esign_certificates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_esign_certificates_provider" ON "esign_certificates" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_esign_annotations_doc" ON "esign_document_annotations" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_esign_annotations_workflow" ON "esign_document_annotations" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_esign_annotations_category" ON "esign_document_annotations" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_esign_annotations_status" ON "esign_document_annotations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_esign_requests_user" ON "esign_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_esign_requests_transaction" ON "esign_requests" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_esign_requests_status" ON "esign_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_esign_requests_provider" ON "esign_requests" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_ef_company" ON "exchange_filings" USING btree ("fintekpro_company_id");--> statement-breakpoint
CREATE INDEX "idx_ef_exchange" ON "exchange_filings" USING btree ("exchange");--> statement-breakpoint
CREATE INDEX "idx_ef_hash" ON "exchange_filings" USING btree ("document_hash");--> statement-breakpoint
CREATE INDEX "idx_ef_date" ON "exchange_filings" USING btree ("filing_date");--> statement-breakpoint
CREATE INDEX "idx_ef_status" ON "exchange_filings" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "idx_efa_company" ON "exchange_financial_audit_log" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_efa_filing" ON "exchange_financial_audit_log" USING btree ("filing_id");--> statement-breakpoint
CREATE INDEX "idx_efa_metric" ON "exchange_financial_audit_log" USING btree ("metric");--> statement-breakpoint
CREATE INDEX "idx_efa_fy" ON "exchange_financial_audit_log" USING btree ("financial_year");--> statement-breakpoint
CREATE INDEX "idx_efa_exchange" ON "exchange_financial_audit_log" USING btree ("exchange");--> statement-breakpoint
CREATE INDEX "idx_efa_created" ON "exchange_financial_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_expense_insights_user" ON "expense_insights" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_expense_insights_type" ON "expense_insights" USING btree ("insight_type");--> statement-breakpoint
CREATE INDEX "idx_expense_insights_status" ON "expense_insights" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_expense_insights_priority" ON "expense_insights" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_et_category" ON "explanation_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_et_status" ON "explanation_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_external_holdings_user" ON "external_holdings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_external_holdings_source" ON "external_holdings" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_erp_order" ON "external_remittance_proofs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_erp_status" ON "external_remittance_proofs" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "idx_erp_user" ON "external_remittance_proofs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_erp_product" ON "external_remittance_proofs" USING btree ("product_type","product_id");--> statement-breakpoint
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
CREATE INDEX "idx_fmal_client" ON "fee_mode_audit_log" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_fmal_timestamp" ON "fee_mode_audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_fmal_changed_by" ON "fee_mode_audit_log" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "idx_financial_audit_log_company" ON "financial_audit_log" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_financial_audit_log_metric" ON "financial_audit_log" USING btree ("metric");--> statement-breakpoint
CREATE INDEX "idx_financial_audit_log_source" ON "financial_audit_log" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_financial_audit_log_fy" ON "financial_audit_log" USING btree ("financial_year");--> statement-breakpoint
CREATE INDEX "idx_financial_audit_log_action" ON "financial_audit_log" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_financial_audit_log_timestamp" ON "financial_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_financial_goals_user" ON "financial_goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_financial_goals_category" ON "financial_goals" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_financial_goals_status" ON "financial_goals" USING btree ("on_track_status");--> statement-breakpoint
CREATE INDEX "idx_fin_cache_type" ON "financial_instruments_cache" USING btree ("instrument_type");--> statement-breakpoint
CREATE INDEX "idx_fin_cache_symbol" ON "financial_instruments_cache" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_fin_cache_type_symbol" ON "financial_instruments_cache" USING btree ("instrument_type","symbol");--> statement-breakpoint
CREATE INDEX "idx_fin_cache_exchange" ON "financial_instruments_cache" USING btree ("exchange");--> statement-breakpoint
CREATE INDEX "idx_financial_obligations_user" ON "financial_obligations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_financial_obligations_type" ON "financial_obligations" USING btree ("obligation_type");--> statement-breakpoint
CREATE INDEX "idx_fi_agent_comm_order" ON "fixed_income_agent_commissions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_fi_agent_comm_agent" ON "fixed_income_agent_commissions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_fi_agent_comm_partner" ON "fixed_income_agent_commissions" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "idx_fi_agent_comm_client" ON "fixed_income_agent_commissions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_fi_agent_comm_settlement" ON "fixed_income_agent_commissions" USING btree ("settlement_status");--> statement-breakpoint
CREATE INDEX "idx_fi_agent_comm_date" ON "fixed_income_agent_commissions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "idx_fi_audit_user" ON "fixed_income_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_fi_audit_event_type" ON "fixed_income_audit_log" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_fi_audit_category" ON "fixed_income_audit_log" USING btree ("event_category");--> statement-breakpoint
CREATE INDEX "idx_fi_audit_timestamp" ON "fixed_income_audit_log" USING btree ("event_timestamp");--> statement-breakpoint
CREATE INDEX "idx_fi_audit_isin" ON "fixed_income_audit_log" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_fi_audit_retention" ON "fixed_income_audit_log" USING btree ("retention_expires_at");--> statement-breakpoint
CREATE INDEX "idx_feed_ingestion_source" ON "fixed_income_feed_ingestion_logs" USING btree ("feed_source");--> statement-breakpoint
CREATE INDEX "idx_feed_ingestion_type" ON "fixed_income_feed_ingestion_logs" USING btree ("feed_type");--> statement-breakpoint
CREATE INDEX "idx_feed_ingestion_status" ON "fixed_income_feed_ingestion_logs" USING btree ("ingestion_status");--> statement-breakpoint
CREATE INDEX "idx_feed_ingestion_time" ON "fixed_income_feed_ingestion_logs" USING btree ("ingestion_start_time");--> statement-breakpoint
CREATE INDEX "idx_fi_notif_prefs_user" ON "fixed_income_notification_prefs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_fi_payments_order" ON "fixed_income_order_payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_fi_payments_user" ON "fixed_income_order_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_fi_payments_status" ON "fixed_income_order_payments" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_fi_payments_gateway" ON "fixed_income_order_payments" USING btree ("payment_gateway");--> statement-breakpoint
CREATE INDEX "idx_fi_payments_gateway_order" ON "fixed_income_order_payments" USING btree ("gateway_order_id");--> statement-breakpoint
CREATE INDEX "idx_fi_reports_user" ON "fixed_income_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_fi_reports_type" ON "fixed_income_reports" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "idx_fi_reports_status" ON "fixed_income_reports" USING btree ("generation_status");--> statement-breakpoint
CREATE INDEX "idx_fi_reports_expires" ON "fixed_income_reports" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_fi_settlements_order" ON "fixed_income_settlements" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_fi_settlements_user" ON "fixed_income_settlements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_fi_settlements_status" ON "fixed_income_settlements" USING btree ("settlement_status");--> statement-breakpoint
CREATE INDEX "idx_fi_settlements_isin" ON "fixed_income_settlements" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_fi_settlements_date" ON "fixed_income_settlements" USING btree ("expected_settlement_date");--> statement-breakpoint
CREATE INDEX "idx_fi_settlements_depository" ON "fixed_income_settlements" USING btree ("depository");--> statement-breakpoint
CREATE INDEX "idx_form15_audit_case" ON "form_15_audit_log" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "idx_form15_audit_user" ON "form_15_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_form15_audit_action" ON "form_15_audit_log" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_form15_audit_created" ON "form_15_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_form15_cases_client" ON "form_15_cases" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_form15_cases_ca" ON "form_15_cases" USING btree ("ca_id");--> statement-breakpoint
CREATE INDEX "idx_form15_cases_agent" ON "form_15_cases" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_form15_cases_status" ON "form_15_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_form15_cases_case_number" ON "form_15_cases" USING btree ("case_number");--> statement-breakpoint
CREATE INDEX "idx_form15_docs_case" ON "form_15_documents" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "idx_form15_docs_type" ON "form_15_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_fund_ratios_scheme_code" ON "fund_financial_ratios" USING btree ("scheme_code");--> statement-breakpoint
CREATE INDEX "idx_fund_ratios_category" ON "fund_financial_ratios" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_fund_ratios_fund_house" ON "fund_financial_ratios" USING btree ("fund_house");--> statement-breakpoint
CREATE INDEX "idx_fund_ratios_ai_signal" ON "fund_financial_ratios" USING btree ("ai_signal");--> statement-breakpoint
CREATE INDEX "idx_fund_managers_name" ON "fund_managers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_fund_managers_fund_house" ON "fund_managers" USING btree ("fund_house");--> statement-breakpoint
CREATE INDEX "idx_fund_perf_monthly_fund" ON "fund_performance_monthwise" USING btree ("fund_type","fund_id");--> statement-breakpoint
CREATE INDEX "idx_fund_perf_monthly_period" ON "fund_performance_monthwise" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX "idx_fund_perf_rolling_fund" ON "fund_performance_rolling" USING btree ("fund_type","fund_id");--> statement-breakpoint
CREATE INDEX "idx_fund_perf_rolling_date" ON "fund_performance_rolling" USING btree ("as_of_date");--> statement-breakpoint
CREATE INDEX "idx_generated_reports_user_id" ON "generated_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_generated_reports_status" ON "generated_reports" USING btree ("report_status");--> statement-breakpoint
CREATE INDEX "idx_generated_reports_type" ON "generated_reports" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "idx_gift_city_products_category" ON "gift_city_products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_gift_city_products_published" ON "gift_city_products" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "idx_gift_city_products_flow" ON "gift_city_products" USING btree ("flow_direction");--> statement-breakpoint
CREATE INDEX "idx_gaa_user" ON "global_advisory_acknowledgments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_gaa_market" ON "global_advisory_acknowledgments" USING btree ("market_code");--> statement-breakpoint
CREATE INDEX "idx_gaa_type" ON "global_advisory_acknowledgments" USING btree ("acknowledgment_type");--> statement-breakpoint
CREATE INDEX "idx_gaa_acknowledged" ON "global_advisory_acknowledgments" USING btree ("acknowledged_at");--> statement-breakpoint
CREATE INDEX "idx_gaal_user" ON "global_advisory_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_gaal_event" ON "global_advisory_audit_log" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_gaal_market" ON "global_advisory_audit_log" USING btree ("market_code");--> statement-breakpoint
CREATE INDEX "idx_gaal_timestamp" ON "global_advisory_audit_log" USING btree ("event_timestamp");--> statement-breakpoint
CREATE INDEX "idx_gar_user" ON "global_advisory_recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_gar_symbol" ON "global_advisory_recommendations" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_gar_asset_class" ON "global_advisory_recommendations" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "idx_gar_market" ON "global_advisory_recommendations" USING btree ("market");--> statement-breakpoint
CREATE INDEX "idx_gar_recommendation" ON "global_advisory_recommendations" USING btree ("recommendation");--> statement-breakpoint
CREATE INDEX "idx_gar_created" ON "global_advisory_recommendations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_gi_symbol" ON "global_instruments" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_gi_asset_class" ON "global_instruments" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "idx_gi_market" ON "global_instruments" USING btree ("market");--> statement-breakpoint
CREATE INDEX "idx_gi_exchange" ON "global_instruments" USING btree ("exchange");--> statement-breakpoint
CREATE INDEX "idx_gi_sector" ON "global_instruments" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "idx_gi_isin" ON "global_instruments" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_gicfm_client" ON "global_investment_client_fee_mode" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_gicfm_mode" ON "global_investment_client_fee_mode" USING btree ("fee_mode");--> statement-breakpoint
CREATE INDEX "idx_gpp_user" ON "global_portfolio_positions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_gpp_instrument" ON "global_portfolio_positions" USING btree ("instrument_id");--> statement-breakpoint
CREATE INDEX "idx_gpp_asset_class" ON "global_portfolio_positions" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "idx_gpp_market" ON "global_portfolio_positions" USING btree ("market");--> statement-breakpoint
CREATE INDEX "idx_goal_investment_links_goal" ON "goal_investment_links" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_goal_investment_links_user" ON "goal_investment_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_goal_investment_links_type" ON "goal_investment_links" USING btree ("investment_type");--> statement-breakpoint
CREATE INDEX "idx_goal_milestones_goal" ON "goal_milestones" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_goal_progress_snapshots_goal" ON "goal_progress_snapshots" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_goal_progress_snapshots_date" ON "goal_progress_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_gov_scheme_audit_user" ON "government_scheme_audit" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_gov_scheme_audit_scheme" ON "government_scheme_audit" USING btree ("scheme_type");--> statement-breakpoint
CREATE INDEX "idx_gov_scheme_audit_event" ON "government_scheme_audit" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_gov_scheme_audit_timestamp" ON "government_scheme_audit" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_gov_scheme_audit_retention" ON "government_scheme_audit" USING btree ("retention_expires_at");--> statement-breakpoint
CREATE INDEX "idx_historical_nav_identifier" ON "historical_nav_data" USING btree ("identifier","identifier_type");--> statement-breakpoint
CREATE INDEX "idx_historical_nav_date" ON "historical_nav_data" USING btree ("identifier","date");--> statement-breakpoint
CREATE INDEX "idx_historical_nav_lookup" ON "historical_nav_data" USING btree ("identifier","identifier_type","date");--> statement-breakpoint
CREATE INDEX "idx_inbound_messages_channel" ON "inbound_messages" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "idx_inbound_messages_from" ON "inbound_messages" USING btree ("from_number");--> statement-breakpoint
CREATE INDEX "idx_inbound_messages_user" ON "inbound_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_inbound_messages_received" ON "inbound_messages" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_inbound_messages_unread" ON "inbound_messages" USING btree ("is_read","received_at");--> statement-breakpoint
CREATE INDEX "idx_income_streams_user" ON "income_streams" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_income_streams_type" ON "income_streams" USING btree ("income_type");--> statement-breakpoint
CREATE INDEX "idx_inspection_evidence_client" ON "inspection_evidence" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_inspection_evidence_transaction" ON "inspection_evidence" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_instrument_master_isin" ON "instrument_master" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_instrument_master_name" ON "instrument_master" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_instrument_master_asset_class" ON "instrument_master" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "idx_instrument_master_symbol" ON "instrument_master" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_instrument_master_prefix" ON "instrument_master" USING btree ("isin_prefix");--> statement-breakpoint
CREATE INDEX "idx_instrument_master_regulator" ON "instrument_master" USING btree ("primary_regulator");--> statement-breakpoint
CREATE INDEX "idx_instrument_master_issuer_type" ON "instrument_master" USING btree ("issuer_type");--> statement-breakpoint
CREATE INDEX "idx_instrument_master_region" ON "instrument_master" USING btree ("region");--> statement-breakpoint
CREATE INDEX "idx_instrument_master_country" ON "instrument_master" USING btree ("country");--> statement-breakpoint
CREATE INDEX "idx_instrument_master_exchange" ON "instrument_master" USING btree ("exchange");--> statement-breakpoint
CREATE INDEX "idx_integration_health_status" ON "integration_health" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_integration_health_category" ON "integration_health" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_investable_surplus_user" ON "investable_surplus" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_investable_surplus_date" ON "investable_surplus" USING btree ("calculation_date");--> statement-breakpoint
CREATE INDEX "idx_investment_inquiries_product" ON "investment_inquiries" USING btree ("product_type","product_id");--> statement-breakpoint
CREATE INDEX "idx_investment_inquiries_user" ON "investment_inquiries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_investment_inquiries_status" ON "investment_inquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_investment_inquiries_assigned" ON "investment_inquiries" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_investment_inquiries_created" ON "investment_inquiries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_override_user" ON "investment_limit_override_proposals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_override_status" ON "investment_limit_override_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_override_proposer" ON "investment_limit_override_proposals" USING btree ("proposed_by");--> statement-breakpoint
CREATE INDEX "idx_override_product" ON "investment_limit_override_proposals" USING btree ("product_category");--> statement-breakpoint
CREATE INDEX "idx_brokerage_investor" ON "investor_brokerage_structures" USING btree ("investor_type");--> statement-breakpoint
CREATE INDEX "idx_brokerage_product" ON "investor_brokerage_structures" USING btree ("product_category");--> statement-breakpoint
CREATE INDEX "idx_brokerage_active" ON "investor_brokerage_structures" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_classification_type" ON "investor_classification_rules" USING btree ("classification_type");--> statement-breakpoint
CREATE INDEX "idx_classification_active" ON "investor_classification_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_invits_symbol" ON "invits" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_invits_sector" ON "invits" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "idx_invits_ai_signal" ON "invits" USING btree ("ai_signal");--> statement-breakpoint
CREATE INDEX "idx_itr_pricing_form_type" ON "itr_pricing_config" USING btree ("itr_form_type");--> statement-breakpoint
CREATE INDEX "idx_itr_pricing_active" ON "itr_pricing_config" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_kal_user" ON "knowledge_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kal_event" ON "knowledge_audit_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_kal_resource" ON "knowledge_audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_kal_client" ON "knowledge_audit_logs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_kal_date" ON "knowledge_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_kd_category" ON "knowledge_disclaimers" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_kd_active" ON "knowledge_disclaimers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_kd_effective" ON "knowledge_disclaimers" USING btree ("effective_from");--> statement-breakpoint
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
CREATE INDEX "idx_kyc_token_map_token" ON "kyc_token_map" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_kyc_token_map_user" ON "kyc_token_map" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_vault_user" ON "kyc_vault" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_vault_status" ON "kyc_vault" USING btree ("kyc_status");--> statement-breakpoint
CREATE INDEX "idx_lead_activity_lead" ON "lead_activities" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_lead_activity_type" ON "lead_activities" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "idx_lead_activity_created" ON "lead_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_lrs_user" ON "lrs_compliance_tracking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_lrs_fy" ON "lrs_compliance_tracking" USING btree ("financial_year");--> statement-breakpoint
CREATE INDEX "idx_lrs_user_fy" ON "lrs_compliance_tracking" USING btree ("user_id","financial_year");--> statement-breakpoint
CREATE INDEX "idx_lrs_alerts_user" ON "lrs_limit_alerts" USING btree ("user_id","financial_year");--> statement-breakpoint
CREATE INDEX "idx_lrs_alerts_type" ON "lrs_limit_alerts" USING btree ("alert_type","acknowledged");--> statement-breakpoint
CREATE INDEX "idx_lrs_tx_user" ON "lrs_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_lrs_tx_tracking" ON "lrs_transactions" USING btree ("tracking_id");--> statement-breakpoint
CREATE INDEX "idx_lrs_tx_date" ON "lrs_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "idx_mb_date" ON "market_briefs" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_mb_region" ON "market_briefs" USING btree ("region");--> statement-breakpoint
CREATE INDEX "idx_mb_status" ON "market_briefs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mdc_symbol_type" ON "market_data_cache" USING btree ("symbol","data_type");--> statement-breakpoint
CREATE INDEX "idx_mdc_expires" ON "market_data_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_mdc_provider" ON "market_data_cache" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_mds_asset_type" ON "market_data_snapshots" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "idx_mds_asset_id" ON "market_data_snapshots" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_mds_snapshot_date" ON "market_data_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_mds_expires" ON "market_data_snapshots" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mds_asset_unique" ON "market_data_snapshots" USING btree ("asset_type","asset_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_mpm_market" ON "market_product_matrix" USING btree ("market_code");--> statement-breakpoint
CREATE INDEX "idx_mpm_product" ON "market_product_matrix" USING btree ("product_category");--> statement-breakpoint
CREATE INDEX "idx_mpm_enabled" ON "market_product_matrix" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "idx_campaign_type" ON "marketing_campaigns" USING btree ("campaign_type");--> statement-breakpoint
CREATE INDEX "idx_campaign_status" ON "marketing_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campaign_created" ON "marketing_campaigns" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_markets_code" ON "markets_master" USING btree ("market_code");--> statement-breakpoint
CREATE INDEX "idx_markets_enabled" ON "markets_master" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "idx_markets_phase" ON "markets_master" USING btree ("rollout_phase");--> statement-breakpoint
CREATE INDEX "idx_mca_charges_cin" ON "mca_charges" USING btree ("cin");--> statement-breakpoint
CREATE INDEX "idx_mca_charges_status" ON "mca_charges" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mca_charges_holder" ON "mca_charges" USING btree ("charge_holder");--> statement-breakpoint
CREATE INDEX "idx_mca_charges_creation" ON "mca_charges" USING btree ("creation_date");--> statement-breakpoint
CREATE INDEX "idx_mca_company_name" ON "mca_company_master" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "idx_mca_company_status" ON "mca_company_master" USING btree ("company_status");--> statement-breakpoint
CREATE INDEX "idx_mca_registered_state" ON "mca_company_master" USING btree ("registered_state");--> statement-breakpoint
CREATE INDEX "idx_mca_last_filing_year" ON "mca_company_master" USING btree ("last_filing_year");--> statement-breakpoint
CREATE INDEX "idx_mca_dm_cin" ON "mca_derived_metrics" USING btree ("cin");--> statement-breakpoint
CREATE INDEX "idx_mca_dm_fy" ON "mca_derived_metrics" USING btree ("financial_year");--> statement-breakpoint
CREATE INDEX "idx_mca_dm_roe" ON "mca_derived_metrics" USING btree ("return_on_equity");--> statement-breakpoint
CREATE INDEX "idx_mca_dp_cin" ON "mca_direct_payments" USING btree ("cin");--> statement-breakpoint
CREATE INDEX "idx_mca_dp_status" ON "mca_direct_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mca_dp_fee_type" ON "mca_direct_payments" USING btree ("fee_type");--> statement-breakpoint
CREATE INDEX "idx_mca_dp_challan" ON "mca_direct_payments" USING btree ("mca_challan_number");--> statement-breakpoint
CREATE INDEX "idx_mca_dp_zoho_status" ON "mca_direct_payments" USING btree ("zoho_sync_status");--> statement-breakpoint
CREATE INDEX "idx_mca_dp_initiated_by" ON "mca_direct_payments" USING btree ("initiated_by");--> statement-breakpoint
CREATE INDEX "idx_mca_dcm_din" ON "mca_director_company_map" USING btree ("din");--> statement-breakpoint
CREATE INDEX "idx_mca_dcm_cin" ON "mca_director_company_map" USING btree ("cin");--> statement-breakpoint
CREATE INDEX "idx_mca_dcm_active" ON "mca_director_company_map" USING btree ("is_currently_active");--> statement-breakpoint
CREATE INDEX "idx_mca_directors_name" ON "mca_directors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_mca_directors_status" ON "mca_directors" USING btree ("din_status");--> statement-breakpoint
CREATE INDEX "idx_mca_ft_cin" ON "mca_filing_tracker" USING btree ("cin");--> statement-breakpoint
CREATE INDEX "idx_mca_ft_filing_year" ON "mca_filing_tracker" USING btree ("filing_year");--> statement-breakpoint
CREATE INDEX "idx_mca_ft_downloaded_by" ON "mca_filing_tracker" USING btree ("downloaded_by");--> statement-breakpoint
CREATE INDEX "idx_mca_ft_status" ON "mca_filing_tracker" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mca_ft_download_date" ON "mca_filing_tracker" USING btree ("download_date");--> statement-breakpoint
CREATE INDEX "idx_mca_fs_cin" ON "mca_financial_snapshot" USING btree ("cin");--> statement-breakpoint
CREATE INDEX "idx_mca_fs_fy" ON "mca_financial_snapshot" USING btree ("financial_year");--> statement-breakpoint
CREATE INDEX "idx_mca_fs_pat" ON "mca_financial_snapshot" USING btree ("profit_after_tax");--> statement-breakpoint
CREATE INDEX "idx_mca_fs_revenue" ON "mca_financial_snapshot" USING btree ("revenue");--> statement-breakpoint
CREATE INDEX "idx_mca_il_run" ON "mca_ingestion_logs" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_mca_il_source" ON "mca_ingestion_logs" USING btree ("source_name");--> statement-breakpoint
CREATE INDEX "idx_mca_il_status" ON "mca_ingestion_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mca_il_started" ON "mca_ingestion_logs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_mca_ql_user" ON "mca_query_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_mca_ql_query_type" ON "mca_query_log" USING btree ("query_type");--> statement-breakpoint
CREATE INDEX "idx_mca_ql_cin" ON "mca_query_log" USING btree ("cin");--> statement-breakpoint
CREATE INDEX "idx_mca_ql_created" ON "mca_query_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_mca_rs_cin" ON "mca_risk_scores" USING btree ("cin");--> statement-breakpoint
CREATE INDEX "idx_mca_rs_date" ON "mca_risk_scores" USING btree ("assessment_date");--> statement-breakpoint
CREATE INDEX "idx_mca_rs_grade" ON "mca_risk_scores" USING btree ("risk_grade");--> statement-breakpoint
CREATE INDEX "idx_mca_rs_overall" ON "mca_risk_scores" USING btree ("overall_risk_score");--> statement-breakpoint
CREATE INDEX "idx_mca_rs_latest" ON "mca_risk_scores" USING btree ("is_latest");--> statement-breakpoint
CREATE INDEX "idx_mca_shp_cin" ON "mca_shareholding_pattern" USING btree ("cin");--> statement-breakpoint
CREATE INDEX "idx_mca_shp_date" ON "mca_shareholding_pattern" USING btree ("reporting_date");--> statement-breakpoint
CREATE INDEX "idx_mca_shp_fy" ON "mca_shareholding_pattern" USING btree ("financial_year");--> statement-breakpoint
CREATE INDEX "idx_mca_shp_latest" ON "mca_shareholding_pattern" USING btree ("is_latest");--> statement-breakpoint
CREATE INDEX "idx_mca_vh_entity" ON "mca_version_history" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_mca_vh_change" ON "mca_version_history" USING btree ("change_type");--> statement-breakpoint
CREATE INDEX "idx_mca_vh_created" ON "mca_version_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_mca_wp_order" ON "mca_wallet_payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_mca_wp_status" ON "mca_wallet_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mca_wp_user" ON "mca_wallet_payments" USING btree ("initiated_by");--> statement-breakpoint
CREATE INDEX "idx_meeting_bookings_client" ON "meeting_bookings" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_bookings_agent" ON "meeting_bookings" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_bookings_status" ON "meeting_bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_meeting_bookings_scheduled" ON "meeting_bookings" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_mbvl_batch" ON "mf_batch_validation_logs" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_mbvl_agent" ON "mf_batch_validation_logs" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_mbvl_arn" ON "mf_batch_validation_logs" USING btree ("arn_code");--> statement-breakpoint
CREATE INDEX "idx_mbvl_outcome" ON "mf_batch_validation_logs" USING btree ("can_proceed","created_at");--> statement-breakpoint
CREATE INDEX "idx_mf_contract_order" ON "mf_contract_notes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_mf_contract_number" ON "mf_contract_notes" USING btree ("contract_note_number");--> statement-breakpoint
CREATE INDEX "idx_mf_folios_user" ON "mf_folios" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_mf_folios_number" ON "mf_folios" USING btree ("folio_number");--> statement-breakpoint
CREATE INDEX "idx_mf_folios_amc" ON "mf_folios" USING btree ("amc_code");--> statement-breakpoint
CREATE INDEX "idx_mf_holdings_user" ON "mf_holdings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_mf_holdings_folio" ON "mf_holdings" USING btree ("folio_id");--> statement-breakpoint
CREATE INDEX "idx_mf_holdings_scheme" ON "mf_holdings" USING btree ("scheme_code");--> statement-breakpoint
CREATE INDEX "mf_monthly_returns_scheme_code_idx" ON "mf_monthly_returns" USING btree ("scheme_code");--> statement-breakpoint
CREATE INDEX "mf_monthly_returns_month_year_idx" ON "mf_monthly_returns" USING btree ("month_year");--> statement-breakpoint
CREATE INDEX "mf_monthly_returns_scheme_code_month_year_idx" ON "mf_monthly_returns" USING btree ("scheme_code","month_year");--> statement-breakpoint
CREATE INDEX "mf_nav_history_scheme_code_idx" ON "mf_nav_history" USING btree ("scheme_code");--> statement-breakpoint
CREATE INDEX "mf_nav_history_nav_date_idx" ON "mf_nav_history" USING btree ("nav_date");--> statement-breakpoint
CREATE INDEX "mf_nav_history_scheme_code_nav_date_idx" ON "mf_nav_history" USING btree ("scheme_code","nav_date");--> statement-breakpoint
CREATE INDEX "idx_mf_order_audit_order" ON "mf_order_audit_log" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_mf_order_audit_actor" ON "mf_order_audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_mf_order_audit_action" ON "mf_order_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_mf_orders_user" ON "mf_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_mf_orders_status" ON "mf_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mf_orders_scheme" ON "mf_orders" USING btree ("scheme_code");--> statement-breakpoint
CREATE INDEX "idx_mf_orders_reference" ON "mf_orders" USING btree ("order_reference");--> statement-breakpoint
CREATE INDEX "idx_mf_orders_created" ON "mf_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_mf_recon_order" ON "mf_reconciliation_entries" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_mf_recon_status" ON "mf_reconciliation_entries" USING btree ("reconciliation_status");--> statement-breakpoint
CREATE INDEX "mf_scheme_exit_loads_scheme_code_idx" ON "mf_scheme_exit_loads" USING btree ("scheme_code");--> statement-breakpoint
CREATE INDEX "mf_scheme_exit_loads_isin_idx" ON "mf_scheme_exit_loads" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_mld_master_isin" ON "mld_master" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_mld_master_issuer" ON "mld_master" USING btree ("issuer");--> statement-breakpoint
CREATE INDEX "idx_mld_master_underlying" ON "mld_master" USING btree ("underlying");--> statement-breakpoint
CREATE INDEX "idx_mld_master_payoff_type" ON "mld_master" USING btree ("payoff_type");--> statement-breakpoint
CREATE INDEX "idx_mld_master_published" ON "mld_master" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "idx_mld_master_status" ON "mld_master" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mld_master_maturity" ON "mld_master" USING btree ("maturity_date");--> statement-breakpoint
CREATE INDEX "idx_mld_monthwise_performance_mld" ON "mld_monthwise_performance" USING btree ("mld_id");--> statement-breakpoint
CREATE INDEX "idx_mld_monthwise_performance_month" ON "mld_monthwise_performance" USING btree ("month_year");--> statement-breakpoint
CREATE INDEX "idx_mld_price_history_mld" ON "mld_price_history" USING btree ("mld_id");--> statement-breakpoint
CREATE INDEX "idx_mld_price_history_date" ON "mld_price_history" USING btree ("price_date");--> statement-breakpoint
CREATE INDEX "idx_mf_metrics_fund" ON "mutual_fund_metrics" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "idx_mf_metrics_scheme" ON "mutual_fund_metrics" USING btree ("scheme_code");--> statement-breakpoint
CREATE INDEX "idx_mf_metrics_fy" ON "mutual_fund_metrics" USING btree ("fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_ncd_issues_status" ON "ncd_public_issues" USING btree ("issue_status");--> statement-breakpoint
CREATE INDEX "idx_ncd_issues_open_date" ON "ncd_public_issues" USING btree ("issue_open_date");--> statement-breakpoint
CREATE INDEX "idx_ncd_issues_issuer" ON "ncd_public_issues" USING btree ("issuer_name");--> statement-breakpoint
CREATE INDEX "idx_invitation_events_invitation" ON "onboarding_invitation_events" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "idx_invitation_events_type" ON "onboarding_invitation_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_onboarding_invitations_referral_code" ON "onboarding_invitations" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "idx_onboarding_invitations_inviter" ON "onboarding_invitations" USING btree ("inviter_id","inviter_type");--> statement-breakpoint
CREATE INDEX "idx_onboarding_invitations_status" ON "onboarding_invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_onboarding_invitations_client_email" ON "onboarding_invitations" USING btree ("client_email");--> statement-breakpoint
CREATE INDEX "idx_order_documents_order" ON "order_documents" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_documents_type" ON "order_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_order_documents_status" ON "order_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ofcl_client" ON "order_fee_consent_log" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_ofcl_order" ON "order_fee_consent_log" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_ofcl_mode" ON "order_fee_consent_log" USING btree ("fee_mode");--> statement-breakpoint
CREATE INDEX "idx_order_events_order" ON "order_lifecycle_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_events_type" ON "order_lifecycle_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_order_events_created" ON "order_lifecycle_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_pan_audit_consent_id" ON "pan_consent_audit_log" USING btree ("consent_id");--> statement-breakpoint
CREATE INDEX "idx_pan_audit_user_id" ON "pan_consent_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pan_audit_timestamp" ON "pan_consent_audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_pan_consents_user_id" ON "pan_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pan_consents_active" ON "pan_consents" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_pending_appointments_status" ON "pending_appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pending_appointments_role" ON "pending_appointments" USING btree ("requested_role");--> statement-breakpoint
CREATE INDEX "idx_pending_appointments_initiator" ON "pending_appointments" USING btree ("initiated_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_pending_appointments_created" ON "pending_appointments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_pick_price_alerts_pick" ON "pick_price_alerts" USING btree ("pick_id");--> statement-breakpoint
CREATE INDEX "idx_pick_price_alerts_user" ON "pick_price_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pick_watchlist_user" ON "pick_watchlist" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pick_watchlist_pick" ON "pick_watchlist" USING btree ("pick_id");--> statement-breakpoint
CREATE INDEX "idx_pff_key" ON "platform_feature_flags" USING btree ("flag_key");--> statement-breakpoint
CREATE INDEX "idx_pff_enabled" ON "platform_feature_flags" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "idx_pff_category" ON "platform_feature_flags" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_fee_config_code" ON "platform_fee_config" USING btree ("fee_code");--> statement-breakpoint
CREATE INDEX "idx_fee_config_category" ON "platform_fee_config" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_fee_config_applicable" ON "platform_fee_config" USING btree ("applicable_to");--> statement-breakpoint
CREATE INDEX "idx_fee_config_active" ON "platform_fee_config" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_pms_master_registration" ON "pms_master" USING btree ("registration_no");--> statement-breakpoint
CREATE INDEX "idx_pms_master_strategy" ON "pms_master" USING btree ("strategy");--> statement-breakpoint
CREATE INDEX "idx_pms_master_published" ON "pms_master" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "idx_pms_master_status" ON "pms_master" USING btree ("fund_status");--> statement-breakpoint
CREATE INDEX "idx_portfolio_alerts_client" ON "portfolio_alerts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_alerts_portfolio" ON "portfolio_alerts" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_alerts_type" ON "portfolio_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "idx_portfolio_alerts_severity" ON "portfolio_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_portfolio_alerts_status" ON "portfolio_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_portfolio_diagnostics_user" ON "portfolio_diagnostics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_diagnostics_date" ON "portfolio_diagnostics" USING btree ("analysis_date");--> statement-breakpoint
CREATE INDEX "idx_portfolio_gen_reports_client" ON "portfolio_generated_reports" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_gen_reports_portfolio" ON "portfolio_generated_reports" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_gen_reports_user" ON "portfolio_generated_reports" USING btree ("generated_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_gen_reports_status" ON "portfolio_generated_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_portfolio_metrics_lookup" ON "portfolio_metrics_cache" USING btree ("identifier","identifier_type","period_years");--> statement-breakpoint
CREATE INDEX "idx_portfolio_metrics_expiry" ON "portfolio_metrics_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_pmd_user" ON "portfolio_metrics_daily" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pmd_portfolio" ON "portfolio_metrics_daily" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_pmd_date" ON "portfolio_metrics_daily" USING btree ("metrics_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pmd_user_portfolio_date_unique" ON "portfolio_metrics_daily" USING btree ("user_id","portfolio_id","metrics_date");--> statement-breakpoint
CREATE INDEX "idx_pmd_needs_rebal" ON "portfolio_metrics_daily" USING btree ("needs_rebalancing");--> statement-breakpoint
CREATE INDEX "idx_portfolio_predictions_user" ON "portfolio_predictions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_predictions_portfolio" ON "portfolio_predictions" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_predictions_date" ON "portfolio_predictions" USING btree ("prediction_date");--> statement-breakpoint
CREATE INDEX "idx_portfolio_report_audit_report" ON "portfolio_report_audit_logs" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_report_audit_user" ON "portfolio_report_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_report_audit_action" ON "portfolio_report_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_portfolio_report_templates_user" ON "portfolio_report_templates" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_report_templates_default" ON "portfolio_report_templates" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "idx_portfolio_uploads_agent" ON "portfolio_uploads" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_uploads_client" ON "portfolio_uploads" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_uploads_status" ON "portfolio_uploads" USING btree ("confirmation_status");--> statement-breakpoint
CREATE INDEX "idx_pre_approved_loan_offers_user" ON "pre_approved_loan_offers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pre_approved_loan_offers_lender" ON "pre_approved_loan_offers" USING btree ("lender_name");--> statement-breakpoint
CREATE INDEX "idx_pre_approved_loan_offers_product_type" ON "pre_approved_loan_offers" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_pre_approved_loan_offers_eligibility" ON "pre_approved_loan_offers" USING btree ("eligibility_status");--> statement-breakpoint
CREATE INDEX "idx_pre_approved_loan_offers_application" ON "pre_approved_loan_offers" USING btree ("application_status");--> statement-breakpoint
CREATE INDEX "idx_pre_approved_loan_offers_validity" ON "pre_approved_loan_offers" USING btree ("offer_valid_until");--> statement-breakpoint
CREATE INDEX "idx_probe42_sync_company" ON "probe42_sync_log" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_probe42_sync_status" ON "probe42_sync_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_probe42_sync_date" ON "probe42_sync_log" USING btree ("last_sync_at");--> statement-breakpoint
CREATE INDEX "idx_eligibility_product" ON "product_eligibility_rules" USING btree ("product_category");--> statement-breakpoint
CREATE INDEX "idx_eligibility_kyc" ON "product_eligibility_rules" USING btree ("min_kyc_tier");--> statement-breakpoint
CREATE INDEX "idx_eligibility_isin" ON "product_eligibility_rules" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_eligibility_active" ON "product_eligibility_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_pfc_product_type" ON "product_fundamentals_cache" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_pfc_product_id" ON "product_fundamentals_cache" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_pfc_expires" ON "product_fundamentals_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pfc_product_unique" ON "product_fundamentals_cache" USING btree ("product_type","product_id");--> statement-breakpoint
CREATE INDEX "idx_pfc_sector" ON "product_fundamentals_cache" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "idx_pk_type" ON "product_knowledge" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_pk_category" ON "product_knowledge" USING btree ("product_category");--> statement-breakpoint
CREATE INDEX "idx_pk_risk" ON "product_knowledge" USING btree ("risk_profile");--> statement-breakpoint
CREATE INDEX "idx_pk_status" ON "product_knowledge" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_proposal_approvals_proposal" ON "proposal_approvals" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_approvals_status" ON "proposal_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_audit_workflow" ON "proposal_esign_audit_logs" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_audit_action" ON "proposal_esign_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_audit_actor" ON "proposal_esign_audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_audit_time" ON "proposal_esign_audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_comm_workflow" ON "proposal_esign_comments" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_comm_version" ON "proposal_esign_comments" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_edit_workflow" ON "proposal_esign_field_edits" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_edit_field" ON "proposal_esign_field_edits" USING btree ("field_name");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_edit_approval" ON "proposal_esign_field_edits" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_part_workflow" ON "proposal_esign_participants" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_part_user" ON "proposal_esign_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_part_email" ON "proposal_esign_participants" USING btree ("external_email");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_part_role" ON "proposal_esign_participants" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_ver_workflow" ON "proposal_esign_versions" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_ver_num" ON "proposal_esign_versions" USING btree ("workflow_id","version_number");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_proposal" ON "proposal_esign_workflows" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_number" ON "proposal_esign_workflows" USING btree ("document_number");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_status" ON "proposal_esign_workflows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_proposal_esign_zoho" ON "proposal_esign_workflows" USING btree ("zoho_sign_request_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_holdings_proposal" ON "proposal_holdings" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_holdings_isin" ON "proposal_holdings" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_proposal_holdings_asset_class" ON "proposal_holdings" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "idx_proposal_interactions_proposal" ON "proposal_interactions" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_interactions_type" ON "proposal_interactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_pm_user" ON "proposal_materializations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pm_client" ON "proposal_materializations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_pm_agent" ON "proposal_materializations" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_pm_input_hash" ON "proposal_materializations" USING btree ("input_hash");--> statement-breakpoint
CREATE INDEX "idx_pm_status" ON "proposal_materializations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pm_expires" ON "proposal_materializations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_pm_type" ON "proposal_materializations" USING btree ("proposal_type");--> statement-breakpoint
CREATE INDEX "idx_proposal_notes_proposal" ON "proposal_notes" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_notes_agent" ON "proposal_notes" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_shares_proposal" ON "proposal_shares" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_shares_client" ON "proposal_shares" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_shares_token" ON "proposal_shares" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "idx_prospect_clients_agent" ON "prospect_clients" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_prospect_clients_state" ON "prospect_clients" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_prospect_clients_pan" ON "prospect_clients" USING btree ("pan");--> statement-breakpoint
CREATE INDEX "idx_prospect_cin" ON "prospect_leads" USING btree ("cin");--> statement-breakpoint
CREATE INDEX "idx_prospect_company_name" ON "prospect_leads" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "idx_prospect_status" ON "prospect_leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_prospect_score" ON "prospect_leads" USING btree ("lead_score");--> statement-breakpoint
CREATE INDEX "idx_prospect_assigned" ON "prospect_leads" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_prospect_created" ON "prospect_leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_prospect_proposal_events_proposal" ON "prospect_proposal_events" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_prospect_proposal_events_type" ON "prospect_proposal_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_prospect_proposals_share_token" ON "prospect_proposals" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "idx_prospect_proposals_agent" ON "prospect_proposals" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_prospect_proposals_status" ON "prospect_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_prospect_proposals_prospect_email" ON "prospect_proposals" USING btree ("prospect_email");--> statement-breakpoint
CREATE INDEX "idx_qa_quiz" ON "quiz_attempts" USING btree ("quiz_id");--> statement-breakpoint
CREATE INDEX "idx_qa_agent" ON "quiz_attempts" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_rbi_rdg_user" ON "rbi_retail_direct_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rbi_rdg_status" ON "rbi_retail_direct_accounts" USING btree ("rdg_account_status");--> statement-breakpoint
CREATE INDEX "idx_rs_user" ON "rebalance_summaries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rs_portfolio" ON "rebalance_summaries" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_rs_status" ON "rebalance_summaries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rs_expires" ON "rebalance_summaries" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_rs_exceeds_drift" ON "rebalance_summaries" USING btree ("exceeds_drift_threshold");--> statement-breakpoint
CREATE INDEX "idx_ra_snapshot" ON "rebalancing_actions" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_ra_user" ON "rebalancing_actions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ra_action" ON "rebalancing_actions" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_ra_status" ON "rebalancing_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ra_symbol" ON "rebalancing_actions" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_rebalancing_recs_user" ON "rebalancing_recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rebalancing_recs_status" ON "rebalancing_recommendations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rebalancing_recs_trigger" ON "rebalancing_recommendations" USING btree ("trigger_reason");--> statement-breakpoint
CREATE INDEX "idx_global_rebal_user" ON "rebalancing_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_global_rebal_status" ON "rebalancing_snapshots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_global_rebal_created" ON "rebalancing_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_recommendation_explanations_rec" ON "recommendation_explanations" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "idx_recommendation_explanations_goal" ON "recommendation_explanations" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_rec_perf_asset_type" ON "recommendation_performance" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "idx_rec_perf_date" ON "recommendation_performance" USING btree ("recommendation_date");--> statement-breakpoint
CREATE INDEX "idx_rec_products_type" ON "recommendation_products" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_rec_products_risk" ON "recommendation_products" USING btree ("risk_profile");--> statement-breakpoint
CREATE INDEX "idx_rec_products_active" ON "recommendation_products" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_rec_products_type_risk" ON "recommendation_products" USING btree ("product_type","risk_profile");--> statement-breakpoint
CREATE INDEX "idx_rec_products_priority" ON "recommendation_products" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_bulletins_body" ON "regulatory_bulletins" USING btree ("regulatory_body");--> statement-breakpoint
CREATE INDEX "idx_bulletins_effective" ON "regulatory_bulletins" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "idx_bulletins_impact" ON "regulatory_bulletins" USING btree ("impact_level");--> statement-breakpoint
CREATE INDEX "idx_violation_user" ON "regulatory_violation_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_violation_type" ON "regulatory_violation_logs" USING btree ("violation_type");--> statement-breakpoint
CREATE INDEX "idx_violation_date" ON "regulatory_violation_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_reit_invit_holdings_user" ON "reit_invit_holdings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_reit_invit_holdings_asset" ON "reit_invit_holdings" USING btree ("asset_type","asset_id");--> statement-breakpoint
CREATE INDEX "idx_reit_invit_metrics_entity" ON "reit_invit_metrics" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_reit_invit_metrics_isin" ON "reit_invit_metrics" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_reit_invit_metrics_fy" ON "reit_invit_metrics" USING btree ("fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_reit_invit_orders_user" ON "reit_invit_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_reit_invit_orders_asset" ON "reit_invit_orders" USING btree ("asset_type","asset_id");--> statement-breakpoint
CREATE INDEX "idx_reit_invit_orders_status" ON "reit_invit_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_reits_symbol" ON "reits" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_reits_sector" ON "reits" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "idx_reits_ai_signal" ON "reits" USING btree ("ai_signal");--> statement-breakpoint
CREATE INDEX "idx_report_access_logs_report_id" ON "report_access_logs" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "idx_report_access_logs_user_id" ON "report_access_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_report_access_logs_accessed_at" ON "report_access_logs" USING btree ("accessed_at");--> statement-breakpoint
CREATE INDEX "idx_return_forecasts_product" ON "return_forecasts" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_return_forecasts_type" ON "return_forecasts" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_risk_analysis_user" ON "risk_analysis" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_risk_analysis_portfolio" ON "risk_analysis" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_risk_analysis_date" ON "risk_analysis" USING btree ("analysis_date");--> statement-breakpoint
CREATE INDEX "idx_disclosure_template_code" ON "risk_disclosure_templates" USING btree ("template_code");--> statement-breakpoint
CREATE INDEX "idx_disclosure_product" ON "risk_disclosure_templates" USING btree ("product_category");--> statement-breakpoint
CREATE INDEX "idx_disclosure_type" ON "risk_disclosure_templates" USING btree ("disclosure_type");--> statement-breakpoint
CREATE INDEX "idx_sr_user" ON "scheduled_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sr_next" ON "scheduled_reports" USING btree ("next_scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_scheme_consents_user" ON "scheme_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_scheme_consents_challenge" ON "scheme_consents" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "idx_scheme_consents_status" ON "scheme_consents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sebi_ai_risk_recommendations_user" ON "sebi_ai_risk_recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sebi_ai_risk_recommendations_status" ON "sebi_ai_risk_recommendations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sebi_ai_risk_recommendations_created" ON "sebi_ai_risk_recommendations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sebi_checklist_category" ON "sebi_clause_checklist" USING btree ("clause_category");--> statement-breakpoint
CREATE INDEX "idx_sebi_checklist_mandatory" ON "sebi_clause_checklist" USING btree ("is_mandatory");--> statement-breakpoint
CREATE INDEX "idx_sebi_client_risk_assessments_user" ON "sebi_client_risk_assessments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sebi_client_risk_assessments_pan" ON "sebi_client_risk_assessments" USING btree ("pan");--> statement-breakpoint
CREATE INDEX "idx_sebi_client_risk_assessments_profile" ON "sebi_client_risk_assessments" USING btree ("profile_code");--> statement-breakpoint
CREATE INDEX "idx_sebi_client_risk_assessments_status" ON "sebi_client_risk_assessments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sebi_client_risk_assessments_created" ON "sebi_client_risk_assessments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sebi_goal_risk_profiles_user" ON "sebi_goal_risk_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sebi_goal_risk_profiles_goal" ON "sebi_goal_risk_profiles" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_sebi_product_suitability_product_type" ON "sebi_product_suitability_matrix" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_sebi_questionnaire_categories_version" ON "sebi_questionnaire_categories" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "idx_sebi_questionnaire_options_question" ON "sebi_questionnaire_options" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_sebi_questionnaire_questions_category" ON "sebi_questionnaire_questions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_sebi_questionnaire_questions_version" ON "sebi_questionnaire_questions" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "idx_sebi_questionnaire_versions_active" ON "sebi_questionnaire_versions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_sebi_risk_audit_user" ON "sebi_risk_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sebi_risk_audit_assessment" ON "sebi_risk_audit_logs" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "idx_sebi_risk_audit_action" ON "sebi_risk_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_sebi_risk_audit_category" ON "sebi_risk_audit_logs" USING btree ("action_category");--> statement-breakpoint
CREATE INDEX "idx_sebi_risk_audit_timestamp" ON "sebi_risk_audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_sell_listings_seller" ON "sell_listings" USING btree ("seller_user_id");--> statement-breakpoint
CREATE INDEX "idx_sell_listings_company" ON "sell_listings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_sell_listings_status" ON "sell_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_sgb_issues_status" ON "sgb_primary_issues" USING btree ("issue_status");--> statement-breakpoint
CREATE INDEX "idx_sgb_issues_open_date" ON "sgb_primary_issues" USING btree ("issue_open_date");--> statement-breakpoint
CREATE INDEX "idx_sgb_issues_fiscal_year" ON "sgb_primary_issues" USING btree ("fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_stamp_duty_audit_transaction" ON "stamp_duty_audit_log" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_stamp_duty_audit_product" ON "stamp_duty_audit_log" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_stamp_duty_audit_date" ON "stamp_duty_audit_log" USING btree ("calculated_at");--> statement-breakpoint
CREATE INDEX "idx_stock_metrics_stock" ON "stock_financial_metrics" USING btree ("stock_id");--> statement-breakpoint
CREATE INDEX "idx_stock_metrics_symbol" ON "stock_financial_metrics" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_stock_metrics_isin" ON "stock_financial_metrics" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_stock_metrics_fy" ON "stock_financial_metrics" USING btree ("fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_stock_metrics_stock_fy" ON "stock_financial_metrics" USING btree ("stock_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_stock_ratios_symbol" ON "stock_financial_ratios" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_stock_ratios_sector" ON "stock_financial_ratios" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "idx_stock_ratios_ai_signal" ON "stock_financial_ratios" USING btree ("ai_signal");--> statement-breakpoint
CREATE INDEX "idx_stock_prices_symbol" ON "stock_prices_cache" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_stock_prices_gainer" ON "stock_prices_cache" USING btree ("is_gainer","gainer_rank");--> statement-breakpoint
CREATE INDEX "idx_stock_prices_loser" ON "stock_prices_cache" USING btree ("is_loser","loser_rank");--> statement-breakpoint
CREATE INDEX "idx_stock_prices_fetched" ON "stock_prices_cache" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "idx_store_txn_user" ON "store_transaction_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_store_txn_category" ON "store_transaction_logs" USING btree ("product_category");--> statement-breakpoint
CREATE INDEX "idx_store_txn_type" ON "store_transaction_logs" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "idx_store_txn_status" ON "store_transaction_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_store_txn_date" ON "store_transaction_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_store_txn_zoho" ON "store_transaction_logs" USING btree ("zoho_sync_status");--> statement-breakpoint
CREATE INDEX "idx_store_txn_source" ON "store_transaction_logs" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_suitability_ack_order" ON "suitability_acknowledgements" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_suitability_ack_user" ON "suitability_acknowledgements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_suitability_checks_session" ON "suitability_checks" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_suitability_checks_client" ON "suitability_checks" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_suitability_checks_passed" ON "suitability_checks" USING btree ("suitability_passed");--> statement-breakpoint
CREATE INDEX "idx_system_configs_key" ON "system_configs" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_system_configs_category" ON "system_configs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_tax_reminder_subscriptions_user_id" ON "tax_reminder_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tax_reminder_subscriptions_status" ON "tax_reminder_subscriptions" USING btree ("subscription_status");--> statement-breakpoint
CREATE INDEX "idx_tax_rules_type_category" ON "tax_rules" USING btree ("rule_type","category");--> statement-breakpoint
CREATE INDEX "idx_tax_rules_effective_from" ON "tax_rules" USING btree ("effective_from");--> statement-breakpoint
CREATE INDEX "idx_tax_rules_is_active" ON "tax_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_tp_user" ON "theme_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_treasury_allocations_mandate" ON "treasury_allocations" USING btree ("mandate_id");--> statement-breakpoint
CREATE INDEX "idx_treasury_allocations_bucket" ON "treasury_allocations" USING btree ("bucket_type");--> statement-breakpoint
CREATE INDEX "idx_treasury_mandates_user" ON "treasury_mandates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_treasury_mandates_status" ON "treasury_mandates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_treasury_proposals_mandate" ON "treasury_proposals" USING btree ("mandate_id");--> statement-breakpoint
CREATE INDEX "idx_treasury_proposals_status" ON "treasury_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ti_type" ON "trending_investments" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "idx_ti_category" ON "trending_investments" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_ti_valid" ON "trending_investments" USING btree ("valid_until");--> statement-breakpoint
CREATE INDEX "idx_unified_cart_user" ON "unified_cart_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_unified_cart_category" ON "unified_cart_items" USING btree ("product_category");--> statement-breakpoint
CREATE INDEX "idx_unified_cart_source" ON "unified_cart_items" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_unified_cart_status" ON "unified_cart_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_unified_orders_user" ON "unified_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_unified_orders_status" ON "unified_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_unified_orders_product_type" ON "unified_orders" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_unified_orders_payment_status" ON "unified_orders" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_unified_orders_execution_status" ON "unified_orders" USING btree ("execution_status");--> statement-breakpoint
CREATE INDEX "idx_unified_orders_created_at" ON "unified_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_unified_orders_order_number" ON "unified_orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "idx_unlisted_audit_company" ON "unlisted_audit_log" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_unlisted_audit_action" ON "unlisted_audit_log" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_unlisted_audit_user" ON "unlisted_audit_log" USING btree ("action_by");--> statement-breakpoint
CREATE INDEX "idx_unlisted_audit_date" ON "unlisted_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_unlisted_cart_user" ON "unlisted_cart" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_unlisted_cart_company" ON "unlisted_cart" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_unlisted_companies_cin" ON "unlisted_companies" USING btree ("cin");--> statement-breakpoint
CREATE INDEX "idx_unlisted_companies_probe42" ON "unlisted_companies" USING btree ("probe42_company_id");--> statement-breakpoint
CREATE INDEX "idx_unlisted_companies_status" ON "unlisted_companies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_unlisted_companies_sector" ON "unlisted_companies" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "idx_unlisted_companies_pricing_status" ON "unlisted_companies" USING btree ("pricing_status");--> statement-breakpoint
CREATE INDEX "idx_unlisted_companies_compliance_status" ON "unlisted_companies" USING btree ("compliance_status");--> statement-breakpoint
CREATE INDEX "idx_status_log_company" ON "unlisted_company_status_log" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_status_log_date" ON "unlisted_company_status_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_unlisted_deals_seller" ON "unlisted_deals" USING btree ("seller_user_id");--> statement-breakpoint
CREATE INDEX "idx_unlisted_deals_buyer" ON "unlisted_deals" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "idx_unlisted_deals_company" ON "unlisted_deals" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_unlisted_deals_status" ON "unlisted_deals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_unlisted_deals_matched" ON "unlisted_deals" USING btree ("matched_at");--> statement-breakpoint
CREATE INDEX "idx_unlisted_deals_market_type" ON "unlisted_deals" USING btree ("market_type");--> statement-breakpoint
CREATE INDEX "idx_unlisted_deals_inventory" ON "unlisted_deals" USING btree ("inventory_sale");--> statement-breakpoint
CREATE INDEX "idx_escrow_approval_deal" ON "unlisted_escrow_approvals" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_escrow_approval_maker" ON "unlisted_escrow_approvals" USING btree ("maker_user_id");--> statement-breakpoint
CREATE INDEX "idx_escrow_approval_checker" ON "unlisted_escrow_approvals" USING btree ("checker_user_id");--> statement-breakpoint
CREATE INDEX "idx_escrow_approval_status" ON "unlisted_escrow_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_investor_tracking_company_fy" ON "unlisted_investor_tracking" USING btree ("company_id","financial_year");--> statement-breakpoint
CREATE INDEX "idx_investor_tracking_user" ON "unlisted_investor_tracking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_price_history_company" ON "unlisted_price_history" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_price_history_date" ON "unlisted_price_history" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_unlisted_reg_audit_user" ON "unlisted_regulatory_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_unlisted_reg_audit_action" ON "unlisted_regulatory_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_unlisted_reg_audit_category" ON "unlisted_regulatory_audit_log" USING btree ("action_category");--> statement-breakpoint
CREATE INDEX "idx_unlisted_reg_audit_entity" ON "unlisted_regulatory_audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_unlisted_reg_audit_company" ON "unlisted_regulatory_audit_log" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_unlisted_reg_audit_deal" ON "unlisted_regulatory_audit_log" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_unlisted_reg_audit_timestamp" ON "unlisted_regulatory_audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_unlisted_reg_audit_retention" ON "unlisted_regulatory_audit_log" USING btree ("retention_expires_at");--> statement-breakpoint
CREATE INDEX "idx_unlisted_reg_audit_compliance" ON "unlisted_regulatory_audit_log" USING btree ("compliance_related");--> statement-breakpoint
CREATE INDEX "idx_unlisted_reg_audit_sebi" ON "unlisted_regulatory_audit_log" USING btree ("sebi_reportable");--> statement-breakpoint
CREATE INDEX "idx_unlisted_risk_disclosure_user" ON "unlisted_risk_disclosure_acknowledgments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_unlisted_risk_disclosure_company" ON "unlisted_risk_disclosure_acknowledgments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_unlisted_risk_disclosure_trade" ON "unlisted_risk_disclosure_acknowledgments" USING btree ("trade_entity_id");--> statement-breakpoint
CREATE INDEX "idx_unlisted_risk_disclosure_version" ON "unlisted_risk_disclosure_acknowledgments" USING btree ("disclosure_version");--> statement-breakpoint
CREATE INDEX "idx_str_status" ON "unlisted_str_flags" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_str_severity" ON "unlisted_str_flags" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_str_user" ON "unlisted_str_flags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_str_due_date" ON "unlisted_str_flags" USING btree ("str_due_date");--> statement-breakpoint
CREATE INDEX "idx_lockin_company_user" ON "unlisted_share_lockin" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_lockin_enddate" ON "unlisted_share_lockin" USING btree ("lockin_end_date");--> statement-breakpoint
CREATE INDEX "idx_lockin_active" ON "unlisted_share_lockin" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_us_broker_accounts_client" ON "us_broker_accounts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_us_broker_accounts_status" ON "us_broker_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_us_consents_client" ON "us_consents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_us_consents_order" ON "us_consents" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_us_consents_hash" ON "us_consents" USING btree ("consent_hash");--> statement-breakpoint
CREATE INDEX "idx_us_holdings_client" ON "us_holdings" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_us_holdings_symbol" ON "us_holdings" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_us_lrs_client" ON "us_lrs_declarations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_us_lrs_fy" ON "us_lrs_declarations" USING btree ("financial_year");--> statement-breakpoint
CREATE INDEX "idx_us_orders_client" ON "us_orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_us_orders_symbol" ON "us_orders" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_us_orders_status" ON "us_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_us_orders_alpaca_id" ON "us_orders" USING btree ("alpaca_order_id");--> statement-breakpoint
CREATE INDEX "idx_us_watchlist_client" ON "us_watchlist" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_user_alerts_user_id" ON "user_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_alerts_type" ON "user_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "idx_user_alerts_category" ON "user_alerts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_user_alerts_active" ON "user_alerts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_user_alerts_symbol" ON "user_alerts" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_user_budgets_user" ON "user_budgets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_budgets_category" ON "user_budgets" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_user_budgets_period" ON "user_budgets" USING btree ("period");--> statement-breakpoint
CREATE INDEX "idx_user_expenses_user" ON "user_expenses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_expenses_category" ON "user_expenses" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_user_expenses_date" ON "user_expenses" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "idx_user_expenses_recurring" ON "user_expenses" USING btree ("recurring_group_id");--> statement-breakpoint
CREATE INDEX "idx_user_classification" ON "user_investor_classifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_classification_status" ON "user_investor_classifications" USING btree ("classification_status");--> statement-breakpoint
CREATE INDEX "idx_classification_type_user" ON "user_investor_classifications" USING btree ("classification_type");--> statement-breakpoint
CREATE INDEX "idx_ump_user" ON "user_market_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ump_market" ON "user_market_preferences" USING btree ("selected_market");--> statement-breakpoint
CREATE INDEX "idx_ur_referrer" ON "user_referrals" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "idx_ur_referee" ON "user_referrals" USING btree ("referee_id");--> statement-breakpoint
CREATE INDEX "idx_ur_code" ON "user_referrals" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "idx_ucc_status_user" ON "user_ucc_status" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ucc_status_ucc" ON "user_ucc_status" USING btree ("ucc_number");--> statement-breakpoint
CREATE INDEX "idx_ucc_status_status" ON "user_ucc_status" USING btree ("ucc_status");--> statement-breakpoint
CREATE INDEX "idx_ucc_status_kra" ON "user_ucc_status" USING btree ("kra_status");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_mobile" ON "users" USING btree ("mobile");--> statement-breakpoint
CREATE INDEX "idx_users_pan_number" ON "users" USING btree ("pan_number");--> statement-breakpoint
CREATE INDEX "idx_vc_type_hash" ON "verification_cache" USING btree ("verification_type","identifier_hash");--> statement-breakpoint
CREATE INDEX "idx_vc_expires" ON "verification_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_vc_provider" ON "verification_cache" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_provider" ON "webhook_logs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_event" ON "webhook_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_status" ON "webhook_logs" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_received" ON "webhook_logs" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_whatsapp_contacts_phone" ON "whatsapp_contacts" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "idx_whatsapp_contacts_user" ON "whatsapp_contacts" USING btree ("user_id");