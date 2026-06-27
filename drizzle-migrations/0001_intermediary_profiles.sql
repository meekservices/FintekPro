-- Migration: intermediary_profiles table (Spec v5 Section 15.5)
-- Adds agent and partner credentialing vault records with encrypted PII,
-- compliance tracking (NISM/ARN/EUIN expiry), KYD status, and admin controls.
--
-- PII columns encrypted at rest via kyc-encryption-service.ts (AES-256-GCM):
--   encrypted_arn_number, encrypted_euin_number, encrypted_bank_account_number,
--   encrypted_ifsc_code, encrypted_gst_registration_number
--
-- These must NEVER appear in application logs. Log intermediary_id only.

CREATE TABLE IF NOT EXISTS "intermediary_profiles" (
  "id"                              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type"                     varchar(20) NOT NULL,
  "parent_intermediary_id"          varchar,
  "canonical_profile_id"            varchar REFERENCES "kyc_vault"("id"),
  "user_id"                         varchar REFERENCES "users"("id"),

  -- ARN (Partners only) — encrypted
  "encrypted_arn_number"            text,
  "arn_status"                      varchar(20) DEFAULT 'pending',
  "arn_expiry_date"                 timestamp,

  -- EUIN (Agents only) — encrypted
  "encrypted_euin_number"           text,
  "euin_status"                     varchar(20) DEFAULT 'pending',
  "euin_expiry_date"                timestamp,
  "parent_arn_number"               varchar,

  -- Qualifications
  "nism_certificate_number"         varchar,
  "nism_certificate_expiry"         timestamp,
  "nism_exam_type"                  varchar(30),
  "nism_cert_document_ref"          varchar,

  -- KYD
  "kyd_status"                      varchar(20) DEFAULT 'pending',
  "kyd_verified_at"                 timestamp,
  "kyd_document_ref"                varchar,

  -- Empanelment (Partners only)
  "empanelled_amcs"                 text[] DEFAULT '{}',
  "empanelled_at"                   jsonb DEFAULT '{}',

  -- Business / Settlement — encrypted
  "encrypted_bank_account_number"   text,
  "encrypted_ifsc_code"             text,
  "commission_payout_method"        varchar DEFAULT 'neft',
  "encrypted_gst_registration_number" text,
  "sebi_registration_number"        varchar,

  -- Admin controls
  "onboarded_at"                    timestamp DEFAULT now(),
  "approved_by_admin_id"            varchar REFERENCES "users"("id"),
  "approval_notes"                  text,
  "suspended_at"                    timestamp,
  "suspension_reason"               text,
  "suspended_by_admin_id"           varchar REFERENCES "users"("id"),
  "reinstated_at"                   timestamp,

  "created_at"                      timestamp DEFAULT now() NOT NULL,
  "updated_at"                      timestamp DEFAULT now() NOT NULL
);

-- Indexes for credential expiry dashboard (Section 15.7)
CREATE INDEX IF NOT EXISTS "idx_intermediary_entity_type"
  ON "intermediary_profiles" ("entity_type");

CREATE INDEX IF NOT EXISTS "idx_intermediary_user"
  ON "intermediary_profiles" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_intermediary_parent"
  ON "intermediary_profiles" ("parent_intermediary_id");

CREATE INDEX IF NOT EXISTS "idx_intermediary_arn_status"
  ON "intermediary_profiles" ("arn_status");

CREATE INDEX IF NOT EXISTS "idx_intermediary_euin_status"
  ON "intermediary_profiles" ("euin_status");

-- Expiry indexes — used by the credential expiry dashboard query
-- (SELECT * WHERE arn_expiry_date BETWEEN now() AND now() + INTERVAL '90 days')
CREATE INDEX IF NOT EXISTS "idx_intermediary_arn_expiry"
  ON "intermediary_profiles" ("arn_expiry_date");

CREATE INDEX IF NOT EXISTS "idx_intermediary_euin_expiry"
  ON "intermediary_profiles" ("euin_expiry_date");

CREATE INDEX IF NOT EXISTS "idx_intermediary_nism_expiry"
  ON "intermediary_profiles" ("nism_certificate_expiry");

-- Constraint: entity_type must be 'agent' or 'partner'
ALTER TABLE "intermediary_profiles"
  ADD CONSTRAINT "chk_entity_type"
  CHECK ("entity_type" IN ('agent', 'partner'));

-- Constraint: arn_status values
ALTER TABLE "intermediary_profiles"
  ADD CONSTRAINT "chk_arn_status"
  CHECK ("arn_status" IN ('pending', 'active', 'suspended', 'expired'));

-- Constraint: euin_status values
ALTER TABLE "intermediary_profiles"
  ADD CONSTRAINT "chk_euin_status"
  CHECK ("euin_status" IN ('pending', 'active', 'suspended', 'expired'));

-- Constraint: kyd_status values
ALTER TABLE "intermediary_profiles"
  ADD CONSTRAINT "chk_kyd_status"
  CHECK ("kyd_status" IN ('pending', 'compliant', 'non_compliant'));
