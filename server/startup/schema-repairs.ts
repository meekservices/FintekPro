export async function runStartupSchemaRepairs() {
      // ── DATABASE REPAIR & MIGRATION ──────────────────────────────────────────
      // Perform critical schema updates needed for boot.
      // We use a dedicated try/catch so migration errors don't necessarily
      // kill the whole server if the core tables are still functional.
      try {
        const { db: migDb } = await import('../db');
        const { sql: migSql } = await import('drizzle-orm');

      console.log('🛠️ Running schema migrations/repairs...');

      // 1. ca_verification_status
      try {
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS ca_verification_status (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            icai_membership_number VARCHAR,
            pan_number VARCHAR,
            icai_verified BOOLEAN DEFAULT false,
            icai_verified_at TIMESTAMPTZ,
            icai_verified_by VARCHAR REFERENCES users(id),
            cop_number VARCHAR,
            cop_valid_from DATE,
            cop_valid_to DATE,
            cop_verified BOOLEAN DEFAULT false,
            cop_verified_at TIMESTAMPTZ,
            pan_verified BOOLEAN DEFAULT false,
            pan_verified_at TIMESTAMPTZ,
            dsc_available BOOLEAN DEFAULT false,
            dsc_serial_number VARCHAR,
            dsc_valid_from DATE,
            dsc_valid_to DATE,
            dsc_verified_at TIMESTAMPTZ,
            overall_status VARCHAR DEFAULT 'pending',
            can_sign_form_15cb BOOLEAN DEFAULT false,
            approved_at TIMESTAMPTZ,
            approved_by VARCHAR REFERENCES users(id),
            rejection_reason TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          ALTER TABLE ca_verification_status
            ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS icai_membership_number VARCHAR,
            ADD COLUMN IF NOT EXISTS pan_number VARCHAR,
            ADD COLUMN IF NOT EXISTS overall_status VARCHAR DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS icai_verified BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS icai_verified_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS icai_verified_by VARCHAR REFERENCES users(id),

ADD COLUMN IF NOT EXISTS cop_number VARCHAR,
            ADD COLUMN IF NOT EXISTS cop_valid_from DATE,
            ADD COLUMN IF NOT EXISTS cop_valid_to DATE,
            ADD COLUMN IF NOT EXISTS cop_verified BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS cop_verified_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS pan_verified BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS pan_verified_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS dsc_available BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS dsc_serial_number VARCHAR,
            ADD COLUMN IF NOT EXISTS dsc_valid_from DATE,
            ADD COLUMN IF NOT EXISTS dsc_valid_to DATE,
            ADD COLUMN IF NOT EXISTS dsc_verified_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS can_sign_form_15cb BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS approved_by VARCHAR REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
            ADD COLUMN IF NOT EXISTS icai_scraped_name      VARCHAR,
            ADD COLUMN IF NOT EXISTS icai_membership_status VARCHAR,
            ADD COLUMN IF NOT EXISTS icai_membership_type   VARCHAR,
            ADD COLUMN IF NOT EXISTS icai_cop_status        VARCHAR,
            ADD COLUMN IF NOT EXISTS icai_confidence_score  NUMERIC(4,2),
            ADD COLUMN IF NOT EXISTS icai_scraped_at        TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS icai_source            VARCHAR,
            ADD COLUMN IF NOT EXISTS icai_raw_html          TEXT,
            ADD COLUMN IF NOT EXISTS icai_error             TEXT
        `);
      } catch (e: any) {
        console.warn('[Migration] ca_verification_status schema skipped:', e?.message);
      }

      // 13. partners ICAI
      try {
        await migDb.execute(migSql`
          ALTER TABLE partners
            ADD COLUMN IF NOT EXISTS icai_scraped_name       VARCHAR,
            ADD COLUMN IF NOT EXISTS icai_scraper_status     VARCHAR DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS icai_scraper_run_at     TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS icai_scraper_source     VARCHAR,
            ADD COLUMN IF NOT EXISTS icai_confidence_score   NUMERIC(4,2),
            ADD COLUMN IF NOT EXISTS icai_cop_status         VARCHAR
        `);
      } catch (e: any) {
        console.warn('[Migration] partners ICAI scraper columns skipped:', e?.message);
      }

      // 14. Subscriptions
      try {
        await migDb.execute(migSql`
          ALTER TABLE users
            ADD COLUMN IF NOT EXISTS plan_tier VARCHAR DEFAULT 'free',
            ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS cashfree_subscription_id VARCHAR;
          CREATE TABLE IF NOT EXISTS platform_subscriptions (
            id                        VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id                   VARCHAR NOT NULL REFERENCES users(id),
            plan_tier                 VARCHAR NOT NULL,
            billing_cycle             VARCHAR NOT NULL,
            amount_paise              INTEGER NOT NULL,
            currency                  VARCHAR DEFAULT 'INR' NOT NULL,
            cashfree_order_id         VARCHAR,
            cashfree_payment_id       VARCHAR,
            cashfree_payment_session_id VARCHAR,
            status                    VARCHAR DEFAULT 'pending' NOT NULL,
            starts_at                 TIMESTAMPTZ,
            expires_at                TIMESTAMPTZ,
            metadata                  JSONB,
            created_at                TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            updated_at                TIMESTAMPTZ DEFAULT NOW() NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_platform_subs_user   ON platform_subscriptions(user_id);
          CREATE INDEX IF NOT EXISTS idx_platform_subs_status ON platform_subscriptions(status);
          CREATE INDEX IF NOT EXISTS idx_platform_subs_tier   ON platform_subscriptions(plan_tier);
        `);
      } catch (e: any) {
        console.warn('[Migration] Subscription monetization schema skipped:', e?.message);
      }

      // 15. audit_trail
      try {
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS audit_trail (
            id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     VARCHAR,
            actor_type  VARCHAR,

action      VARCHAR NOT NULL,
            category    VARCHAR NOT NULL,
            details     TEXT,
            ip_address  VARCHAR,
            user_agent  TEXT,
            outcome     VARCHAR,
            risk_level  VARCHAR,
            created_at  TIMESTAMPTZ DEFAULT NOW()
          );
          ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS actor_type VARCHAR;
        `);
      } catch (e: any) {
        console.error('[Migration] audit_trail table error:', e?.message);
      }

      // 16. self_healing
      try {
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS self_healing_events (
            id            SERIAL PRIMARY KEY,
            event_type    VARCHAR(50) NOT NULL,
            trigger_message TEXT,
            action_taken  VARCHAR(100),
            success       BOOLEAN,
            message       TEXT,
            context       TEXT,
            occurred_at   TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_self_healing_events_occurred_at
            ON self_healing_events (occurred_at DESC);

          CREATE TABLE IF NOT EXISTS self_healing_feedback (
            id            SERIAL PRIMARY KEY,
            module        VARCHAR(50)  NOT NULL,
            operation     VARCHAR(100) NOT NULL,
            duration_ms   INTEGER,
            success       BOOLEAN      NOT NULL DEFAULT true,
            error_message TEXT,
            risk_level    VARCHAR(10),
            fallback_used BOOLEAN      DEFAULT false,
            occurred_at   TIMESTAMPTZ  DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_self_healing_feedback_module_occurred
            ON self_healing_feedback (module, occurred_at DESC);
        `);
      } catch (e: any) {
        console.error('[Migration] self_healing tables error:', e?.message);
      }

      // 17. iris_sessions
      try {
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS iris_sessions (
            id           VARCHAR PRIMARY KEY,
            pan          VARCHAR NOT NULL UNIQUE,
            cookies      JSONB NOT NULL,
            expires_at   TIMESTAMPTZ NOT NULL,
            created_at   TIMESTAMPTZ DEFAULT NOW()
          );
        `);
      } catch (e: any) {
        console.warn('[Migration] iris_sessions table skipped:', e?.message);
      }

      // 18. compliance_audit_trail repair
      try {
        await migDb.execute(migSql`
          ALTER TABLE compliance_audit_trail 
            ADD COLUMN IF NOT EXISTS field_changed varchar,
            ADD COLUMN IF NOT EXISTS entity_id varchar,
            ADD COLUMN IF NOT EXISTS entity_type varchar,
            ADD COLUMN IF NOT EXISTS performed_by varchar,
            ADD COLUMN IF NOT EXISTS performed_by_role varchar,
            ADD COLUMN IF NOT EXISTS old_value jsonb,
            ADD COLUMN IF NOT EXISTS new_value jsonb,
            ADD COLUMN IF NOT EXISTS risk_impact varchar,
            ADD COLUMN IF NOT EXISTS compliance_impact varchar,
            ADD COLUMN IF NOT EXISTS reason text,
            ADD COLUMN IF NOT EXISTS metadata jsonb,
            ADD COLUMN IF NOT EXISTS timestamp timestamp DEFAULT NOW();
        `);
        console.log('✅ compliance_audit_trail schema verified');
      } catch (e: any) {
        console.warn('[Migration] compliance_audit_trail repair skipped:', e?.message);
      }

      // 19. unlisted_regulatory_audit_log repair
      try {
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS unlisted_regulatory_audit_log (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR REFERENCES users(id),
            user_email VARCHAR,
            user_name VARCHAR,
            user_role VARCHAR,
            user_kyc_tier VARCHAR,
            user_pan VARCHAR,
            action VARCHAR NOT NULL,
            action_category VARCHAR NOT NULL,
            entity_type VARCHAR NOT NULL,
            entity_id VARCHAR NOT NULL,
            company_id VARCHAR REFERENCES unlisted_companies(id),
            company_cin VARCHAR,
            company_name VARCHAR,
            deal_id VARCHAR,
            counterparty_user_id VARCHAR,
            counterparty_pan VARCHAR,
            quantity BIGINT,
            price_per_share DECIMAL(20, 2),
            total_value DECIMAL(20, 2),
            platform_fee DECIMAL(20, 2),
            gst_amount DECIMAL(20, 2),
            escrow_amount DECIMAL(20, 2),

before_state JSONB,
            after_state JSONB,
            change_description TEXT,
            compliance_related BOOLEAN DEFAULT false,
            compliance_flags JSONB DEFAULT '[]',
            risk_level VARCHAR,
            compliance_officer VARCHAR,
            compliance_notes TEXT,
            sebi_reportable BOOLEAN DEFAULT false,
            sebi_reported_at TIMESTAMPTZ,
            sebi_report_ref VARCHAR,
            rbi_reportable BOOLEAN DEFAULT false,
            rbi_reported_at TIMESTAMPTZ,
            rbi_report_ref VARCHAR,
            ip_address VARCHAR,
            user_agent TEXT,
            session_id VARCHAR,
            device_fingerprint VARCHAR,
            geo_location VARCHAR,
            document_ids JSONB DEFAULT '[]',
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            retention_expires_at TIMESTAMPTZ,
            archived BOOLEAN DEFAULT false,
            archived_at TIMESTAMPTZ,
            metadata JSONB DEFAULT '{}',
            forensic_hash VARCHAR(64),
            prev_hash VARCHAR(64)
          );
          CREATE INDEX IF NOT EXISTS idx_unlisted_reg_audit_user ON unlisted_regulatory_audit_log(user_id);
          CREATE INDEX IF NOT EXISTS idx_unlisted_reg_audit_action ON unlisted_regulatory_audit_log(action);
          CREATE INDEX IF NOT EXISTS idx_unlisted_reg_audit_category ON unlisted_regulatory_audit_log(action_category);
          CREATE INDEX IF NOT EXISTS idx_unlisted_reg_audit_entity ON unlisted_regulatory_audit_log(entity_type, entity_id);
          CREATE INDEX IF NOT EXISTS idx_unlisted_reg_audit_company ON unlisted_regulatory_audit_log(company_id);
          CREATE INDEX IF NOT EXISTS idx_unlisted_reg_audit_deal ON unlisted_regulatory_audit_log(deal_id);
          CREATE INDEX IF NOT EXISTS idx_unlisted_reg_audit_timestamp ON unlisted_regulatory_audit_log(timestamp);
          CREATE INDEX IF NOT EXISTS idx_unlisted_reg_audit_retention ON unlisted_regulatory_audit_log(retention_expires_at);
        `);
        console.log('✅ unlisted_regulatory_audit_log schema verified');
      } catch (e: any) {
        console.error('[Migration] unlisted_regulatory_audit_log table error:', e?.message);
      }

      // 20. daily_picks table and enums
      try {
        // Create enums if they don't exist
        await migDb.execute(migSql`
          DO $$ 
          BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pick_category') THEN
                  CREATE TYPE pick_category AS ENUM ('listed_stocks', 'mutual_funds', 'bonds', 'unlisted', 'global_stocks', 'etfs', 'reits_invits', 'fixed_deposits', 'sgb', 'derivatives');
              END IF;
              IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pick_status') THEN
                  CREATE TYPE pick_status AS ENUM ('live', 'target_hit', 'stoploss_hit', 'expired');
              END IF;
          END $$;
        `);

        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS daily_picks (
            id SERIAL PRIMARY KEY,
            category pick_category NOT NULL DEFAULT 'listed_stocks',
            instrument_id VARCHAR(100),
            instrument_name VARCHAR(255) NOT NULL,
            isin VARCHAR(12),
            symbol VARCHAR(50),
            market VARCHAR(20),
            exchange VARCHAR(20),
            reco_date DATE,
            reco_price NUMERIC(18, 4),
            target_price NUMERIC(18, 4),
            stoploss_price NUMERIC(18, 4),
            current_price NUMERIC(18, 4),
            status pick_status DEFAULT 'live',
            expiry_date DATE,
            status_updated_at TIMESTAMPTZ,
            return_pct NUMERIC(8, 2),
            days_held INTEGER,
            rationale TEXT,
            risk_level VARCHAR(20),
            suitable_for TEXT[],
            time_horizon VARCHAR(20),
            confidence_score INTEGER,
            sector_category VARCHAR(100),
            key_metrics JSONB,
            generated_by VARCHAR(50),
            scoring_version VARCHAR(20),
            scoring_breakdown JSONB,
            risk_score INTEGER,
            is_active BOOLEAN DEFAULT true,
            is_live BOOLEAN DEFAULT false,
            published_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
        `);

        // Add missing columns if table already existed with old schema
        await migDb.execute(migSql`
          DO $$

BEGIN
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='category') THEN
                  ALTER TABLE daily_picks ADD COLUMN category pick_category NOT NULL DEFAULT 'listed_stocks';
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='instrument_id') THEN
                  ALTER TABLE daily_picks ADD COLUMN instrument_id VARCHAR(100);
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='instrument_name') THEN
                  ALTER TABLE daily_picks ADD COLUMN instrument_name VARCHAR(255) DEFAULT '';
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='isin') THEN
                  ALTER TABLE daily_picks ADD COLUMN isin VARCHAR(12);
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='reco_date') THEN
                  ALTER TABLE daily_picks ADD COLUMN reco_date DATE;
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='reco_price') THEN
                  ALTER TABLE daily_picks ADD COLUMN reco_price NUMERIC(18, 4);
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='stoploss_price') THEN
                  ALTER TABLE daily_picks ADD COLUMN stoploss_price NUMERIC(18, 4);
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='status') THEN
                  ALTER TABLE daily_picks ADD COLUMN status pick_status DEFAULT 'live';
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='expiry_date') THEN
                  ALTER TABLE daily_picks ADD COLUMN expiry_date DATE;
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='suitable_for') THEN
                  ALTER TABLE daily_picks ADD COLUMN suitable_for TEXT[];
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='confidence_score') THEN
                  ALTER TABLE daily_picks ADD COLUMN confidence_score INTEGER;
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='target_price') THEN
                  ALTER TABLE daily_picks ADD COLUMN target_price NUMERIC(18, 4);
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='current_price') THEN
                  ALTER TABLE daily_picks ADD COLUMN current_price NUMERIC(18, 4);
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='time_horizon') THEN
                  ALTER TABLE daily_picks ADD COLUMN time_horizon VARCHAR(20);
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='key_metrics') THEN
                  ALTER TABLE daily_picks ADD COLUMN key_metrics JSONB;
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='rationale') THEN
                  ALTER TABLE daily_picks ADD COLUMN rationale TEXT;
              END IF;
          END $$;
        `);
        console.log('✅ daily_picks schema verified and updated');
      } catch (e: any) {
        console.error('[Migration] daily_picks table error:', e?.message);
      }

      // 21. Alpaca Integration Tables
      try {
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS alpaca_accounts (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR NOT NULL REFERENCES users(id),
            alpaca_account_id VARCHAR NOT NULL UNIQUE,
            status VARCHAR NOT NULL,
            account_number VARCHAR,
            currency VARCHAR DEFAULT 'USD',

crypto_status VARCHAR,
            buying_power DECIMAL(15, 2),
            cash DECIMAL(15, 2),
            portfolio_value DECIMAL(15, 2),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS alpaca_orders (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR NOT NULL REFERENCES users(id),
            alpaca_account_id VARCHAR NOT NULL,
            provider_order_id VARCHAR NOT NULL UNIQUE,
            client_order_id VARCHAR NOT NULL UNIQUE,
            symbol VARCHAR NOT NULL,
            qty DECIMAL(15, 4),
            notional DECIMAL(15, 2),
            side VARCHAR NOT NULL,
            type VARCHAR NOT NULL,
            time_in_force VARCHAR NOT NULL,
            status VARCHAR NOT NULL,
            filled_qty DECIMAL(15, 4),
            filled_avg_price DECIMAL(15, 2),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS alpaca_positions (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR NOT NULL REFERENCES users(id),
            alpaca_account_id VARCHAR NOT NULL,
            symbol VARCHAR NOT NULL,
            qty DECIMAL(15, 4) NOT NULL,
            avg_entry_price DECIMAL(15, 2) NOT NULL,
            current_price DECIMAL(15, 2) NOT NULL,
            market_value DECIMAL(15, 2) NOT NULL,
            unrealized_pl DECIMAL(15, 2) NOT NULL,
            unrealized_plpc DECIMAL(15, 4) NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS alpaca_trade_logs (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR NOT NULL REFERENCES users(id),
            alpaca_account_id VARCHAR NOT NULL,
            symbol VARCHAR NOT NULL,
            side VARCHAR NOT NULL,
            quantity DECIMAL(15, 4),
            notional DECIMAL(15, 2),
            status VARCHAR NOT NULL,
            provider_order_id VARCHAR,
            commission DECIMAL(12, 2) DEFAULT '0.00',
            error_message TEXT,
            timestamp TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_alpaca_accounts_user ON alpaca_accounts(user_id);
          CREATE INDEX IF NOT EXISTS idx_alpaca_orders_user ON alpaca_orders(user_id);
          CREATE INDEX IF NOT EXISTS idx_alpaca_positions_user ON alpaca_positions(user_id);
        `);
        console.log('✅ Alpaca integration tables verified');
      } catch (e: any) {
        console.error('[Migration] Alpaca tables error:', e?.message);
      }

      // 22. User Social Referral Columns
      try {
        await migDb.execute(migSql`
          ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS referral_code VARCHAR UNIQUE,
            ADD COLUMN IF NOT EXISTS shareable_profile_enabled BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS alpaca_account_id VARCHAR;
          CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

          CREATE TABLE IF NOT EXISTS user_trusted_devices (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR NOT NULL REFERENCES users(id),
            device_token_hash TEXT NOT NULL UNIQUE,
            device_name VARCHAR,
            user_agent TEXT,
            ip_address VARCHAR,
            trusted_at TIMESTAMPTZ DEFAULT NOW(),
            last_seen_at TIMESTAMPTZ DEFAULT NOW(),
            revoked_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_user_trusted_devices_user ON user_trusted_devices(user_id);
          CREATE INDEX IF NOT EXISTS idx_user_trusted_devices_revoked ON user_trusted_devices(revoked_at);
        `);
        console.log('✅ User social referral and trusted device columns verified');
      } catch (e: any) {
        console.error('[Migration] User social columns error:', e?.message);
      }

      // 23. Global Asset & RTA Metadata Enrichment
      try {
        await migDb.execute(migSql`
          -- Comprehensive Holdings Metadata
          ALTER TABLE comprehensive_holdings
            ADD COLUMN IF NOT EXISTS currency VARCHAR DEFAULT 'INR',
            ADD COLUMN IF NOT EXISTS is_adr BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS exchange_mic VARCHAR,
            ADD COLUMN IF NOT EXISTS enrichment_source VARCHAR,
            ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ;

          -- Market Data Cache Fundamental Metrics
          ALTER TABLE market_data_cache
            ADD COLUMN IF NOT EXISTS market_cap NUMERIC(20, 2),
            ADD COLUMN IF NOT EXISTS beta NUMERIC(10, 4),
            ADD COLUMN IF NOT EXISTS dividend_yield NUMERIC(10, 4),
            ADD COLUMN IF NOT EXISTS pe_ratio NUMERIC(10, 4);

          -- Mutual Funds RTA Tracking
          ALTER TABLE mutual_funds
            ADD COLUMN IF NOT EXISTS kfintech_id VARCHAR,
            ADD COLUMN IF NOT EXISTS folio_nature VARCHAR;
        `);
        console.log('✅ Global asset and RTA metadata columns verified');
      } catch (e: any) {

console.error('[Migration] Metadata enrichment error:', e?.message);
      }

      // 24. IRIS KFintech investor ID column on users (missing from production DB)
      try {
        await migDb.execute(migSql`
          ALTER TABLE users
            ADD COLUMN IF NOT EXISTS iris_investor_id VARCHAR;
        `);
        console.log('✅ iris_investor_id column on users verified');
      } catch (e: any) {
        console.error('[Migration] iris_investor_id column error:', e?.message);
      }

      // 25. Alpaca account type
      try {
        await migDb.execute(migSql`
          ALTER TABLE users
            ADD COLUMN IF NOT EXISTS alpaca_account_type VARCHAR DEFAULT 'individual';
        `);
        console.log('✅ alpaca_account_type column on users verified');
      } catch (e: any) {
        console.error('[Migration] alpaca_account_type column error:', e?.message);
      }

      // 26. SGB Schema & Repairs (sgb_primary_issues, sovereign_gold_bonds)
      try {
        console.log('🛠️ Verifying sovereign_gold_bonds table...');
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS sovereign_gold_bonds (
            id SERIAL PRIMARY KEY,
            series_code VARCHAR(50),
            series_name VARCHAR(255),
            issue_open_date DATE,
            issue_close_date DATE,
            issue_price_per_gram NUMERIC(18, 4),
            gold_weight_grams NUMERIC(18, 4),
            minimum_investment_grams NUMERIC(18, 4),
            maximum_investment_grams NUMERIC(18, 4),
            interest_rate NUMERIC(8, 4),
            tenor_years INTEGER,
            premature_exit_year INTEGER,
            listing_date DATE,
            issue_status VARCHAR(50),
            subscription_type VARCHAR(50),
            discount_on_digital NUMERIC(18, 4),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            last_updated TIMESTAMPTZ DEFAULT NOW(),
            tranche_number VARCHAR(50),
            fiscal_year VARCHAR(20),
            issue_name TEXT,
            issue_year INTEGER,
            maturity_date DATE,
            issue_price NUMERIC(18, 4)
          );
        `);

        const { runSgbRepair } = await import("../db-migrations/sgb-repair");
        await runSgbRepair();
      } catch (e: any) {
        console.warn('[Migration] SGB repair sequence skipped:', e?.message);
      }

      // 27. NCD & Governance Schema Repair (Fixes SQL 42703 issue_name)
      try {
        const { runGovernanceNcdRepair } = await import("../db-migrations/governance-ncd-repair");
        await runGovernanceNcdRepair();
      } catch (e: any) {
        console.warn('[Migration] Governance/NCD repair skipped:', e?.message);
      }

      try {
        await migDb.execute(migSql`
          ALTER TABLE unlisted_regulatory_audit_log
            ADD COLUMN IF NOT EXISTS forensic_hash VARCHAR(64),
            ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64);
        `);
        console.log('✅ forensic_hash/prev_hash columns on unlisted_regulatory_audit_log verified');
      } catch (e: any) {
        console.warn('[Migration] unlisted_regulatory_audit_log forensic columns skipped:', e?.message);
      }

      // 28. KYC and LRS userProfiles & lrsComplianceTracking repairs
      try {
        await migDb.execute(migSql`
          ALTER TABLE user_profiles
            ADD COLUMN IF NOT EXISTS pan_verified_via_sandbox BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS pan_sandbox_status VARCHAR,
            ADD COLUMN IF NOT EXISTS pan_verified_via_smart_kyc BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS aadhaar_verified_via_smart_kyc BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS kra_verified_via_protean BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS video_kyc_completed BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS video_kyc_completed_date TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS video_kyc_completed_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS face_to_face_verification_completed BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS face_to_face_verification_date TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS ckyc_fetched_via_auth_bridge BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS ckyc_auth_bridge_status VARCHAR,
            ADD COLUMN IF NOT EXISTS ckyc_auth_bridge_response JSONB,
            ADD COLUMN IF NOT EXISTS kyc_level VARCHAR DEFAULT '0',
            ADD COLUMN IF NOT EXISTS kyc_level_upgraded_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS kyc_tier_upgraded_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS is_high_risk_customer BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS net_worth_amount NUMERIC(15, 2),
            ADD COLUMN IF NOT EXISTS investor_type VARCHAR;

          ALTER TABLE lrs_compliance_tracking
            ADD COLUMN IF NOT EXISTS form15ca_filed BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS form15cb_obtained BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS tax_residency_certificate BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS w8ben_filed BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS w8ben_expiry_date DATE;
        `);
        console.log('✅ KYC & LRS columns on user_profiles & lrs_compliance_tracking verified');
      } catch (e: any) {
        console.error('[Migration] user_profiles & lrs_compliance_tracking KYC columns error:', e?.message);
      }

      // ── Algo Signal Engine (FASP-AI v1.0) ────────────────────────────────────
      // algo_signals table: Decision Support System signals for US equities.
      // Added 2026-05-30. Safe CREATE TABLE IF NOT EXISTS — idempotent.
      try {
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS algo_signals (
            id                 SERIAL PRIMARY KEY,
            user_id            VARCHAR REFERENCES users(id),
            symbol             VARCHAR(20) NOT NULL,
            company_name       VARCHAR(200),
            strategy           VARCHAR(50) NOT NULL DEFAULT 'composite',
            signal             VARCHAR(10) NOT NULL,
            confidence_score   INTEGER NOT NULL,
            suggested_qty      NUMERIC(18, 6),
            suggested_notional NUMERIC(18, 2),
            entry_price        NUMERIC(18, 4),
            target_price       NUMERIC(18, 4),
            stop_loss_price    NUMERIC(18, 4),
            factors            JSONB,
            model_version      VARCHAR(30) NOT NULL DEFAULT 'algo-v1.0',
            risk_profile       VARCHAR(30),
            investment_horizon VARCHAR(20),
            status             VARCHAR(20) NOT NULL DEFAULT 'pending',
            approved_at        TIMESTAMPTZ,
            rejected_at        TIMESTAMPTZ,
            order_id           VARCHAR(100),
            disclaimer         TEXT,
            expires_at         TIMESTAMPTZ,
            created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          -- Fix: user_id was created as INTEGER in old DB — silently alter to VARCHAR if needed
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'algo_signals' AND column_name = 'user_id' AND data_type = 'integer'
            ) THEN
              ALTER TABLE algo_signals ALTER COLUMN user_id TYPE VARCHAR USING user_id::VARCHAR;
            END IF;
          END $$;
          CREATE INDEX IF NOT EXISTS idx_algo_signals_user    ON algo_signals(user_id);
          CREATE INDEX IF NOT EXISTS idx_algo_signals_symbol  ON algo_signals(symbol);
          CREATE INDEX IF NOT EXISTS idx_algo_signals_status  ON algo_signals(status);
          CREATE INDEX IF NOT EXISTS idx_algo_signals_created ON algo_signals(created_at);
        `);
        console.log('✅ algo_signals table verified (FASP-AI v1.0 DSS)');
      } catch (e: any) {
        console.error('[Migration] algo_signals table error:', e?.message);
      }

        console.log('✅ Critical schema repairs complete');

      // ── 29. REITs & InvITs — schema drift repair ──────────────────────────────
      // The reits/invits tables in production are missing columns added in the
      // reit-invit.ts schema after the initial table creation, causing a
      // "Failed query: select ... from reits where symbol = $1" error on every
      // price refresh cycle.
      try {
        await migDb.execute(migSql`
          -- REITs: add any columns that may be missing from the production table
          ALTER TABLE reits
            ADD COLUMN IF NOT EXISTS sponsor TEXT,
            ADD COLUMN IF NOT EXISTS manager TEXT,
            ADD COLUMN IF NOT EXISTS trustee TEXT,
            ADD COLUMN IF NOT EXISTS listing_date TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS exchange VARCHAR DEFAULT 'NSE',
            ADD COLUMN IF NOT EXISTS isin_code VARCHAR,
            ADD COLUMN IF NOT EXISTS property_type VARCHAR,
            ADD COLUMN IF NOT EXISTS geography TEXT,
            ADD COLUMN IF NOT EXISTS total_properties INTEGER,
            ADD COLUMN IF NOT EXISTS total_leasable_area DECIMAL(15,2),
            ADD COLUMN IF NOT EXISTS occupancy_rate DECIMAL(5,2),
            ADD COLUMN IF NOT EXISTS nav DECIMAL(15,4),
            ADD COLUMN IF NOT EXISTS premium_to_nav DECIMAL(8,4),
            ADD COLUMN IF NOT EXISTS week_high_52 DECIMAL(15,4),
            ADD COLUMN IF NOT EXISTS week_low_52 DECIMAL(15,4),
            ADD COLUMN IF NOT EXISTS market_cap DECIMAL(20,2),
            ADD COLUMN IF NOT EXISTS distribution_yield DECIMAL(8,4),
            ADD COLUMN IF NOT EXISTS dividend_frequency VARCHAR DEFAULT 'quarterly',
            ADD COLUMN IF NOT EXISTS last_dividend DECIMAL(10,4),
            ADD COLUMN IF NOT EXISTS last_dividend_date TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS returns_1m DECIMAL(8,4),
            ADD COLUMN IF NOT EXISTS returns_3m DECIMAL(8,4),
            ADD COLUMN IF NOT EXISTS returns_6m DECIMAL(8,4),
            ADD COLUMN IF NOT EXISTS returns_1y DECIMAL(8,4),
            ADD COLUMN IF NOT EXISTS returns_3y DECIMAL(8,4),
            ADD COLUMN IF NOT EXISTS returns_since_inception DECIMAL(8,4),
            ADD COLUMN IF NOT EXISTS debt_to_equity DECIMAL(10,4),
            ADD COLUMN IF NOT EXISTS interest_coverage_ratio DECIMAL(10,4),
            ADD COLUMN IF NOT EXISTS funds_from_operations DECIMAL(15,2),
            ADD COLUMN IF NOT EXISTS net_operating_income DECIMAL(15,2),
            ADD COLUMN IF NOT EXISTS minimum_investment DECIMAL(15,2),
            ADD COLUMN IF NOT EXISTS lot_size INTEGER DEFAULT 1,
            ADD COLUMN IF NOT EXISTS face_value DECIMAL(10,2),
            ADD COLUMN IF NOT EXISTS risk_level VARCHAR DEFAULT 'moderate',
            ADD COLUMN IF NOT EXISTS credit_rating VARCHAR,
            ADD COLUMN IF NOT EXISTS rating_agency VARCHAR,
            ADD COLUMN IF NOT EXISTS ai_signal VARCHAR DEFAULT 'hold',
            ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(5,2),
            ADD COLUMN IF NOT EXISTS ai_rationale TEXT,
            ADD COLUMN IF NOT EXISTS ai_target_price DECIMAL(15,4),
            ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW();

          CREATE INDEX IF NOT EXISTS idx_reits_symbol    ON reits(symbol);
          CREATE INDEX IF NOT EXISTS idx_reits_sector    ON reits(sector);
          CREATE INDEX IF NOT EXISTS idx_reits_ai_signal ON reits(ai_signal);
        `);
        console.log('✅ reits schema columns verified');
      } catch (e: any) {
        console.warn('[Migration] reits column repair skipped:', e?.message);
      }

      try {
        await migDb.execute(migSql`
          -- InvITs: add any columns that may be missing
          ALTER TABLE invits
            ADD COLUMN IF NOT EXISTS sponsor TEXT,
            ADD COLUMN IF NOT EXISTS manager TEXT,
            ADD COLUMN IF NOT EXISTS trustee TEXT,
            ADD COLUMN IF NOT EXISTS listing_date TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS exchange VARCHAR DEFAULT 'NSE',
            ADD COLUMN IF NOT EXISTS isin_code VARCHAR,
            ADD COLUMN IF NOT EXISTS infrastructure_type VARCHAR,
            ADD COLUMN IF NOT EXISTS geography TEXT,
            ADD COLUMN IF NOT EXISTS total_assets INTEGER,
            ADD COLUMN IF NOT EXISTS asset_details TEXT,
            ADD COLUMN IF NOT EXISTS concession_life DECIMAL(5,1),
            ADD COLUMN IF NOT EXISTS nav DECIMAL(15,4),
            ADD COLUMN IF NOT EXISTS premium_to_nav DECIMAL(8,4),
            ADD COLUMN IF NOT EXISTS week_high_52 DECIMAL(15,4),
            ADD COLUMN IF NOT EXISTS week_low_52 DECIMAL(15,4),
            ADD COLUMN IF NOT EXISTS market_cap DECIMAL(20,2),
            ADD COLUMN IF NOT EXISTS distribution_yield DECIMAL(8,4),
            ADD COLUMN IF NOT EXISTS dividend_frequency VARCHAR DEFAULT 'quarterly',
            ADD COLUMN IF NOT EXISTS last_dividend DECIMAL(10,4),
            ADD COLUMN IF NOT EXISTS last_dividend_date TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS returns_1m DECIMAL(8,4),
            ADD COLUMN IF NOT EXISTS returns_3m DECIMAL(8,4),
            ADD COLUMN IF NOT EXISTS returns_6m DECIMAL(8,4),
            ADD COLUMN IF NOT EXISTS returns_1y DECIMAL(8,4),
            ADD COLUMN IF NOT EXISTS returns_3y DECIMAL(8,4),
            ADD COLUMN IF NOT EXISTS returns_since_inception DECIMAL(8,4),
            ADD COLUMN IF NOT EXISTS debt_to_equity DECIMAL(10,4),
            ADD COLUMN IF NOT EXISTS interest_coverage_ratio DECIMAL(10,4),
            ADD COLUMN IF NOT EXISTS ebitda DECIMAL(15,2),
            ADD COLUMN IF NOT EXISTS cash_flow_from_operations DECIMAL(15,2),
            ADD COLUMN IF NOT EXISTS minimum_investment DECIMAL(15,2),
            ADD COLUMN IF NOT EXISTS lot_size INTEGER DEFAULT 1,
            ADD COLUMN IF NOT EXISTS face_value DECIMAL(10,2),
            ADD COLUMN IF NOT EXISTS risk_level VARCHAR DEFAULT 'moderate',
            ADD COLUMN IF NOT EXISTS credit_rating VARCHAR,
            ADD COLUMN IF NOT EXISTS rating_agency VARCHAR,
            ADD COLUMN IF NOT EXISTS ai_signal VARCHAR DEFAULT 'hold',
            ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(5,2),
            ADD COLUMN IF NOT EXISTS ai_rationale TEXT,
            ADD COLUMN IF NOT EXISTS ai_target_price DECIMAL(15,4),
            ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW();

          CREATE INDEX IF NOT EXISTS idx_invits_symbol    ON invits(symbol);
          CREATE INDEX IF NOT EXISTS idx_invits_sector    ON invits(sector);
          CREATE INDEX IF NOT EXISTS idx_invits_ai_signal ON invits(ai_signal);
        `);
        console.log('✅ invits schema columns verified');
      } catch (e: any) {
        console.warn('[Migration] invits column repair skipped:', e?.message);
      }

      // ── 30. mutual_funds — comprehensive schema drift repair ──────────────────
      // The mutual_funds table in production was created from an early schema
      // version and is missing many columns that MFSync, AutoPublish, and the
      // MFReturns sync now query.  All ALTER TABLE statements are idempotent.
      try {
        await migDb.execute(migSql`
          ALTER TABLE mutual_funds
            -- Publishing controls
            ADD COLUMN IF NOT EXISTS is_published      BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS is_active         BOOLEAN DEFAULT true,
            ADD COLUMN IF NOT EXISTS published_at      TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS published_by      VARCHAR,
            ADD COLUMN IF NOT EXISTS plan_type         VARCHAR DEFAULT 'regular',

            -- NAV fields
            ADD COLUMN IF NOT EXISTS nav               DECIMAL(10, 4),
            ADD COLUMN IF NOT EXISTS change            DECIMAL(10, 4),
            ADD COLUMN IF NOT EXISTS change_percent    DECIMAL(8, 4),

            -- Returns (MFReturnsSync writes these)
            ADD COLUMN IF NOT EXISTS returns_1y        DECIMAL(8, 4),
            ADD COLUMN IF NOT EXISTS returns_3y        DECIMAL(8, 4),
            ADD COLUMN IF NOT EXISTS returns_5y        DECIMAL(8, 4),

            -- AMFI / source tracking (MFSync reads these)
            ADD COLUMN IF NOT EXISTS amfi_code         VARCHAR,
            ADD COLUMN IF NOT EXISTS isin              VARCHAR,
            ADD COLUMN IF NOT EXISTS option_type       VARCHAR,
            ADD COLUMN IF NOT EXISTS scheme_status     VARCHAR DEFAULT 'active',
            ADD COLUMN IF NOT EXISTS data_source       VARCHAR,
            ADD COLUMN IF NOT EXISTS last_verified_at  TIMESTAMPTZ,

            -- Extended AMFI fields
            ADD COLUMN IF NOT EXISTS isin_dividend_payout    VARCHAR,
            ADD COLUMN IF NOT EXISTS isin_dividend_reinvest  VARCHAR,
            ADD COLUMN IF NOT EXISTS isin_growth             VARCHAR,
            ADD COLUMN IF NOT EXISTS repurchase_price        DECIMAL(15, 4),
            ADD COLUMN IF NOT EXISTS sale_price              DECIMAL(15, 4),
            ADD COLUMN IF NOT EXISTS launch_date             DATE,
            ADD COLUMN IF NOT EXISTS min_sip_amount          DECIMAL(15, 2),
            ADD COLUMN IF NOT EXISTS min_lumpsum_amount      DECIMAL(15, 2),
            ADD COLUMN IF NOT EXISTS amc_code                VARCHAR,
            ADD COLUMN IF NOT EXISTS exit_load_percent       DECIMAL(8, 4),
            ADD COLUMN IF NOT EXISTS exit_load_days          INTEGER,
            ADD COLUMN IF NOT EXISTS scheme_sub_category     VARCHAR,

            -- Benchmark mapping
            ADD COLUMN IF NOT EXISTS benchmark_index         VARCHAR,
            ADD COLUMN IF NOT EXISTS benchmark_index_code    VARCHAR,
            ADD COLUMN IF NOT EXISTS benchmark_confidence_score DECIMAL(3, 2),

            -- FintekPro Smart Rating (stored in crisil_* columns)
            ADD COLUMN IF NOT EXISTS crisil_rating            INTEGER,
            ADD COLUMN IF NOT EXISTS crisil_category          VARCHAR,
            ADD COLUMN IF NOT EXISTS crisil_percentile        DECIMAL(5, 2),
            ADD COLUMN IF NOT EXISTS crisil_evaluation_date   TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS crisil_risk_adjusted_score DECIMAL(8, 4),
            ADD COLUMN IF NOT EXISTS crisil_asset_quality_score DECIMAL(8, 4),
            ADD COLUMN IF NOT EXISTS crisil_liquidity_score   DECIMAL(8, 4),
            ADD COLUMN IF NOT EXISTS crisil_concentration_score DECIMAL(8, 4),
            ADD COLUMN IF NOT EXISTS crisil_overall_score     DECIMAL(8, 4),
            ADD COLUMN IF NOT EXISTS crisil_data_source       VARCHAR DEFAULT 'calculated',
            ADD COLUMN IF NOT EXISTS crisil_last_updated      TIMESTAMPTZ,

            -- Extended data blob
            ADD COLUMN IF NOT EXISTS extended_data            JSONB,

            -- SEBI 2026 compliance
            ADD COLUMN IF NOT EXISTS taxonomy_version         VARCHAR DEFAULT 'SEBI_2017',
            ADD COLUMN IF NOT EXISTS compliance_status        VARCHAR DEFAULT 'PENDING',
            ADD COLUMN IF NOT EXISTS naming_validation_status VARCHAR DEFAULT 'PENDING',
            ADD COLUMN IF NOT EXISTS lifecycle_metadata       JSONB,
            ADD COLUMN IF NOT EXISTS compliance_blocked_reason TEXT,

            -- IRIS / KFintech
            ADD COLUMN IF NOT EXISTS kfintech_id              VARCHAR,
            ADD COLUMN IF NOT EXISTS folio_nature             VARCHAR,

            -- Timestamps
            ADD COLUMN IF NOT EXISTS last_updated             TIMESTAMPTZ DEFAULT NOW();

          CREATE INDEX IF NOT EXISTS idx_mutual_funds_is_published ON mutual_funds(is_published);
          CREATE INDEX IF NOT EXISTS idx_mutual_funds_is_active    ON mutual_funds(is_active);
          CREATE INDEX IF NOT EXISTS idx_mutual_funds_amfi_code    ON mutual_funds(amfi_code);
          CREATE INDEX IF NOT EXISTS idx_mutual_funds_isin         ON mutual_funds(isin);
          CREATE INDEX IF NOT EXISTS idx_mutual_funds_last_verified ON mutual_funds(last_verified_at);
          CREATE INDEX IF NOT EXISTS idx_mutual_funds_scheme_status ON mutual_funds(scheme_status);
        `);
        console.log('✅ mutual_funds comprehensive column repair complete');
      } catch (e: any) {
        console.warn('[Migration] mutual_funds column repair skipped:', e?.message);
      }

      try {
        await migDb.execute(migSql`
          ALTER TABLE bond_catalog
            ADD COLUMN IF NOT EXISTS is_active    BOOLEAN DEFAULT true,
            ADD COLUMN IF NOT EXISTS face_value   NUMERIC(18,4),
            ADD COLUMN IF NOT EXISTS maturity_date DATE;
          CREATE INDEX IF NOT EXISTS idx_bond_catalog_is_active    ON bond_catalog(is_active);
          CREATE INDEX IF NOT EXISTS idx_bond_catalog_maturity     ON bond_catalog(maturity_date);
        `);
        console.log('✅ bond_catalog is_active/maturity_date columns verified');
      } catch (e: any) {
        console.warn('[Migration] bond_catalog columns skipped:', e?.message);
      }

      // ── 31. error_alert_threshold — missing monitoring table ─────────────────
      // ErrorWebhookService / ErrorSpikeDetectionService query this table to
      // determine per-module spike thresholds.  Missing table causes a cascade of
      // Failed query errors on every error ingested.
      try {
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS error_alert_threshold (
            id                      SERIAL PRIMARY KEY,
            module                  VARCHAR(100),
            error_code              VARCHAR(50),
            window_minutes          INTEGER NOT NULL DEFAULT 5,
            occurrence_threshold    INTEGER NOT NULL DEFAULT 10,
            is_enabled              BOOLEAN NOT NULL DEFAULT true,
            auto_escalate_to_critical BOOLEAN DEFAULT false,
            created_by              VARCHAR,
            created_at              TIMESTAMPTZ DEFAULT NOW(),
            updated_at              TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_error_alert_threshold_module
            ON error_alert_threshold(module);
          CREATE INDEX IF NOT EXISTS idx_error_alert_threshold_enabled
            ON error_alert_threshold(is_enabled);

          -- Seed a sensible global default (module IS NULL means "any module")
          INSERT INTO error_alert_threshold
            (module, error_code, window_minutes, occurrence_threshold, is_enabled, auto_escalate_to_critical, created_by)
          SELECT NULL, NULL, 5, 20, true, false, 'system'
          WHERE NOT EXISTS (
            SELECT 1 FROM error_alert_threshold WHERE module IS NULL AND error_code IS NULL
          );
        `);
        console.log('✅ error_alert_threshold table verified');
      } catch (e: any) {
        console.warn('[Migration] error_alert_threshold table skipped:', e?.message);
      }

      // ── 32. instrument_master — last_price column ─────────────────────────────
      // PickOfTheDay price sync reads last_price from instrument_master.
      // The column may be missing if the table was created before this field.
      try {
        await migDb.execute(migSql`
          ALTER TABLE instrument_master
            ADD COLUMN IF NOT EXISTS last_price NUMERIC(18, 4);
          CREATE INDEX IF NOT EXISTS idx_instrument_master_last_price
            ON instrument_master(last_price) WHERE last_price IS NOT NULL;
        `);
        console.log('✅ instrument_master last_price column verified');
      } catch (e: any) {
        console.warn('[Migration] instrument_master last_price skipped:', e?.message);
      }

      // ── 33. goal_benchmark_mapping — ProposalBuilder missing table ────────────
      // ProposalBuilder benchmark defaults init queries goal_benchmark_mapping
      // on startup but the table doesn't exist in production yet.
      try {
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS goal_benchmark_mapping (
            id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            goal_type           VARCHAR(50) NOT NULL,
            risk_profile        VARCHAR(30) NOT NULL,
            benchmark_index     VARCHAR(100),
            benchmark_code      VARCHAR(50),
            benchmark_name      VARCHAR(200),
            benchmark_rationale TEXT,
            horizon_years_min   INTEGER,
            horizon_years_max   INTEGER,
            is_default          BOOLEAN DEFAULT true,
            is_active           BOOLEAN DEFAULT true,
            overridden_by       VARCHAR REFERENCES users(id),
            overridden_at       TIMESTAMPTZ,
            description         TEXT,
            created_at          TIMESTAMPTZ DEFAULT NOW(),
            updated_at          TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_goal_benchmark_goal_type
            ON goal_benchmark_mapping(goal_type);
          CREATE INDEX IF NOT EXISTS idx_goal_benchmark_risk_profile
            ON goal_benchmark_mapping(risk_profile);
          CREATE INDEX IF NOT EXISTS idx_goal_benchmark_active
            ON goal_benchmark_mapping(is_active);

          -- Seed sensible defaults for common goal + risk profile combos
          INSERT INTO goal_benchmark_mapping
            (goal_type, risk_profile, benchmark_index, benchmark_code, benchmark_name, benchmark_rationale, horizon_years_min, horizon_years_max, is_default)
          VALUES
            ('retirement',    'conservative', 'CRISIL Composite Bond Fund',  'CRISIL_BOND',  'CRISIL Composite Bond Fund Index',  'Low-risk debt benchmark for conservative retirement planning', 10, 30, true),
            ('retirement',    'moderate',     'Nifty 50',                    'NIFTY50',      'Nifty 50 Index',                    'Balanced equity benchmark for moderate risk retirement', 10, 30, true),
            ('retirement',    'aggressive',   'Nifty 500',                   'NIFTY500',     'Nifty 500 Index',                   'Broad equity benchmark for aggressive retirement growth',  10, 30, true),
            ('education',     'conservative', 'CRISIL Short Term Bond',      'CRISIL_ST',    'CRISIL Short Term Bond Index',      'Short duration bond index for education corpus planning',  5, 15, true),
            ('education',     'moderate',     'Nifty 50',                    'NIFTY50',      'Nifty 50 Index',                    'Equity benchmark for moderate education savings',          5, 15, true),
            ('wealth',        'moderate',     'Nifty 50',                    'NIFTY50',      'Nifty 50 Index',                    'Standard equity benchmark for wealth creation',            3, 20, true),
            ('wealth',        'aggressive',   'Nifty Midcap 150',            'NIFTY_MC150',  'Nifty Midcap 150 Index',            'Midcap benchmark for aggressive wealth creation',          5, 20, true),
            ('emergency',     'conservative', 'CRISIL Liquid Fund',          'CRISIL_LQ',    'CRISIL Liquid Fund Index',          'Liquid fund benchmark for emergency corpus',               0, 1,  true),
            ('home_purchase', 'moderate',     'Nifty 50',                    'NIFTY50',      'Nifty 50 Index',                    'Equity benchmark for home purchase savings',               3, 10, true)
          ON CONFLICT DO NOTHING;
        `);
        console.log('✅ goal_benchmark_mapping table verified with defaults');
      } catch (e: any) {
        console.warn('[Migration] goal_benchmark_mapping table skipped:', e?.message);
      }

      // ── Mobile: push_tokens table ────────────────────────────────────────
      try {
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS push_tokens (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token       TEXT NOT NULL UNIQUE,
            platform    VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
        `);
        console.log('✅ push_tokens table verified (mobile push notifications)');
      } catch (e: any) {
        console.warn('[Migration] push_tokens table skipped:', e?.message);
      }

      } catch (migErr) {
        console.error('❌ Migration sequence failed (non-fatal):', migErr);
      }
}
