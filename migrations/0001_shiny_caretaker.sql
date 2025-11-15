CREATE TYPE "public"."api_health_status" AS ENUM('healthy', 'degraded', 'down', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."audit_action_type" AS ENUM('create', 'read', 'update', 'delete', 'execute', 'approve', 'reject');--> statement-breakpoint
CREATE TYPE "public"."error_severity" AS ENUM('critical', 'high', 'medium', 'low', 'info');--> statement-breakpoint
CREATE TYPE "public"."error_source" AS ENUM('frontend', 'backend', 'service', 'external_api');--> statement-breakpoint
CREATE TABLE "api_health_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" varchar NOT NULL,
	"endpoint" varchar,
	"check_type" varchar DEFAULT 'ping',
	"status" "api_health_status" NOT NULL,
	"latency_ms" integer,
	"response_code" integer,
	"failure_reason" text,
	"error_message" text,
	"incident_id" varchar,
	"metadata" jsonb,
	"checked_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"actor_type" varchar NOT NULL,
	"actor_id" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"action" "audit_action_type" NOT NULL,
	"resource" varchar NOT NULL,
	"resource_id" varchar,
	"operation" varchar NOT NULL,
	"status" varchar NOT NULL,
	"regulatory_category" varchar,
	"sensitivity_level" varchar DEFAULT 'medium',
	"changes_before" jsonb,
	"changes_after" jsonb,
	"previous_log_hash" varchar,
	"current_log_hash" varchar,
	"metadata" jsonb,
	"reason" text,
	"occurred_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "error_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "error_source" NOT NULL,
	"severity" "error_severity" DEFAULT 'medium' NOT NULL,
	"environment" varchar DEFAULT 'production',
	"service" varchar NOT NULL,
	"message" text NOT NULL,
	"error_type" varchar,
	"error_code" varchar,
	"stack_hash" varchar,
	"user_id" varchar,
	"session_id" varchar,
	"request_id" varchar,
	"http_method" varchar,
	"http_path" varchar,
	"http_status_code" integer,
	"user_agent" text,
	"ip_address" varchar,
	"device_info" jsonb,
	"payload" jsonb,
	"tags" text[],
	"ingestion_ts" timestamp DEFAULT now(),
	"occurred_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "error_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stack_hash" varchar NOT NULL,
	"service" varchar NOT NULL,
	"environment" varchar NOT NULL,
	"severity" "error_severity" NOT NULL,
	"total_count" integer DEFAULT 0,
	"affected_users" integer DEFAULT 0,
	"first_occurrence" timestamp NOT NULL,
	"last_occurrence" timestamp NOT NULL,
	"ai_analyzed" boolean DEFAULT false,
	"ai_findings" jsonb,
	"ai_analyzed_at" timestamp,
	"status" varchar DEFAULT 'open',
	"assigned_to" varchar,
	"resolved_at" timestamp,
	"resolution" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "error_stack_traces" (
	"stack_hash" varchar PRIMARY KEY NOT NULL,
	"stack_trace" text NOT NULL,
	"source_map" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_name" varchar NOT NULL,
	"metric_type" varchar NOT NULL,
	"service" varchar,
	"environment" varchar DEFAULT 'production',
	"dimensions" jsonb,
	"value" numeric(15, 4) NOT NULL,
	"unit" varchar,
	"aggregation_window" varchar DEFAULT '1m',
	"collected_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_certificate_number" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_certificate_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "risk_declaration_url" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_esign_status" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_status_source" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "accredited_investor_status" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "accredited_investor_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "accredited_investor_expiry_date" timestamp;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_stack_hash_error_stack_traces_stack_hash_fk" FOREIGN KEY ("stack_hash") REFERENCES "public"."error_stack_traces"("stack_hash") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_events" ADD CONSTRAINT "error_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_groups" ADD CONSTRAINT "error_groups_stack_hash_error_stack_traces_stack_hash_fk" FOREIGN KEY ("stack_hash") REFERENCES "public"."error_stack_traces"("stack_hash") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_health_service_checked" ON "api_health_logs" USING btree ("service","checked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_api_health_status" ON "api_health_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_api_health_incident" ON "api_health_logs" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "idx_audit_user_occurred" ON "audit_logs" USING btree ("user_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_audit_resource" ON "audit_logs" USING btree ("resource","resource_id");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_regulatory" ON "audit_logs" USING btree ("regulatory_category");--> statement-breakpoint
CREATE INDEX "idx_audit_occurred" ON "audit_logs" USING btree ("occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_error_events_severity_ts" ON "error_events" USING btree ("severity","ingestion_ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_error_events_service_ts" ON "error_events" USING btree ("service","ingestion_ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_error_events_user_ts" ON "error_events" USING btree ("user_id","ingestion_ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_error_events_stack_hash" ON "error_events" USING btree ("stack_hash");--> statement-breakpoint
CREATE INDEX "idx_error_events_occurred" ON "error_events" USING btree ("occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_error_groups_stack_hash" ON "error_groups" USING btree ("stack_hash");--> statement-breakpoint
CREATE INDEX "idx_error_groups_service_severity" ON "error_groups" USING btree ("service","severity");--> statement-breakpoint
CREATE INDEX "idx_error_groups_status" ON "error_groups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_error_groups_last_occurrence" ON "error_groups" USING btree ("last_occurrence" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_error_groups_unique" ON "error_groups" USING btree ("stack_hash","service","environment");--> statement-breakpoint
CREATE INDEX "idx_error_stack_created" ON "error_stack_traces" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_system_metrics_name_collected" ON "system_metrics" USING btree ("metric_name","collected_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_system_metrics_service_collected" ON "system_metrics" USING btree ("service","collected_at" DESC NULLS LAST);