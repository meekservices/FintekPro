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
            user_id            INTEGER REFERENCES users(id),
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
      } catch (migErr) {

        console.error('❌ Migration sequence failed (non-fatal):', migErr);
      }
}
