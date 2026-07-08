/* eslint-disable no-console */
// schema-repairs.ts — startup bootstrap migration utility.
// console.* is intentional here: logger depends on DB which may not be ready yet.
export async function runStartupSchemaRepairs() {
	// ── DATABASE REPAIR & MIGRATION ──────────────────────────────────────────
	// Perform critical schema updates needed for boot.
	// We use a dedicated try/catch so migration errors don't necessarily
	// kill the whole server if the core tables are still functional.
	try {
		const { db: migDb } = await import("../db");
		const { pool: migPool } = await import("../db");
		const { sql: migSql } = await import("drizzle-orm");

		console.log("🛠️ Running schema migrations/repairs...");

		// ── CRITICAL FAST-PATH: model_portfolios period return columns ────────
		// These columns are referenced by the Drizzle ORM schema on every
		// GET /api/model-portfolios call. They must exist before routes serve.
		// Use pool.query() directly — node-postgres Drizzle driver does NOT
		// support db.execute({ sql, params }) object form for raw DDL.
		const _criticalCols: Array<[string, string]> = [
			["return_1m",                "NUMERIC(8,4)"],
			["return_3m",                "NUMERIC(8,4)"],
			["return_6m",                "NUMERIC(8,4)"],
			["return_ytd",               "NUMERIC(8,4)"],
			["cagr_2y",                  "NUMERIC(8,4)"],
			["return_since_inception",   "NUMERIC(8,4)"],
			["benchmark_since_inception","NUMERIC(8,4)"],
			["periods_computed_at",      "TIMESTAMPTZ"],
		];
		let _ccOk = 0;
		for (const [col, colType] of _criticalCols) {
			try {
				await migPool.query(`ALTER TABLE model_portfolios ADD COLUMN IF NOT EXISTS "${col}" ${colType}`);
				_ccOk++;
			} catch { /* column already exists or table missing — non-fatal */ }
		}
		console.log(`  ✅ [CRITICAL] model_portfolios period columns: ${_ccOk}/${_criticalCols.length} ensured`);
		// ── END CRITICAL FAST-PATH ────────────────────────────────────────────


		// ── INFRA-M3: Schema Migration Log ────────────────────────────────────
		// Tracks which migrations have already been applied so they are skipped
		// on subsequent boots. Reduces startup round-trips from 100+ individual
		// IF NOT EXISTS checks to near-zero on warm restarts.
		//
		// The table itself is always created (idempotent CREATE IF NOT EXISTS).
		// Every migration that succeeds logs itself here.
		// isMigrationApplied() checks this log before running a migration block.
		await migDb.execute(migSql`
      CREATE TABLE IF NOT EXISTS schema_migration_log (
        migration_id  VARCHAR(255) PRIMARY KEY,
        applied_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        engine        VARCHAR(50)  NOT NULL DEFAULT 'FASP-AI-v3.0'
      )
    `);
		console.log("  ✅ schema_migration_log: ready");

		/**
		 * Returns true if the given migration_id has already been applied.
		 * Use this to skip expensive IF NOT EXISTS migrations on subsequent boots.
		 */
		async function isMigrationApplied(migrationId: string): Promise<boolean> {
			try {
				const rows = await migDb.execute(
					migSql`SELECT 1 FROM schema_migration_log WHERE migration_id = ${migrationId} LIMIT 1`,
				);
				return (rows as any).rows?.length > 0;
			} catch {
				return false; // if the table itself failed to create, run the migration
			}
		}

		/**
		 * Marks a migration as applied in the log.
		 * Call this after a migration block succeeds.
		 */
		async function markMigrationApplied(migrationId: string): Promise<void> {
			try {
				await migDb.execute(migSql`
          INSERT INTO schema_migration_log (migration_id)
          VALUES (${migrationId})
          ON CONFLICT (migration_id) DO NOTHING
        `);
			} catch {
				// Non-fatal — migration ran but log failed; will re-run next boot (idempotent)
			}
		}

		// Expose helpers to the outer scope for use in migration blocks below.
		// (TypeScript hoisting: these are used in blocks further down the file.)
		void isMigrationApplied; // suppress "declared but never read" if only some blocks use it
		void markMigrationApplied;

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
			console.warn(
				"[Migration] ca_verification_status schema skipped:",
				e?.message,
			);
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
			console.warn(
				"[Migration] partners ICAI scraper columns skipped:",
				e?.message,
			);
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
			console.warn(
				"[Migration] Subscription monetization schema skipped:",
				e?.message,
			);
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
			console.error("[Migration] audit_trail table error:", e?.message);
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
			console.error("[Migration] self_healing tables error:", e?.message);
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
			console.warn("[Migration] iris_sessions table skipped:", e?.message);
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
			console.log("✅ compliance_audit_trail schema verified");
		} catch (e: any) {
			console.warn(
				"[Migration] compliance_audit_trail repair skipped:",
				e?.message,
			);
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
			console.log("✅ unlisted_regulatory_audit_log schema verified");
		} catch (e: any) {
			console.error(
				"[Migration] unlisted_regulatory_audit_log table error:",
				e?.message,
			);
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
			console.log("✅ daily_picks schema verified and updated");
		} catch (e: any) {
			console.error("[Migration] daily_picks table error:", e?.message);
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
			console.log("✅ Alpaca integration tables verified");
		} catch (e: any) {
			console.error("[Migration] Alpaca tables error:", e?.message);
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
			console.log(
				"✅ User social referral and trusted device columns verified",
			);
		} catch (e: any) {
			console.error("[Migration] User social columns error:", e?.message);
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
			console.log("✅ Global asset and RTA metadata columns verified");
		} catch (e: any) {
			console.error("[Migration] Metadata enrichment error:", e?.message);
		}

		// 24. IRIS KFintech investor ID column on users (missing from production DB)
		try {
			await migDb.execute(migSql`
          ALTER TABLE users
            ADD COLUMN IF NOT EXISTS iris_investor_id VARCHAR;
        `);
			console.log("✅ iris_investor_id column on users verified");
		} catch (e: any) {
			console.error("[Migration] iris_investor_id column error:", e?.message);
		}

		// 25. Alpaca account type
		try {
			await migDb.execute(migSql`
          ALTER TABLE users
            ADD COLUMN IF NOT EXISTS alpaca_account_type VARCHAR DEFAULT 'individual';
        `);
			console.log("✅ alpaca_account_type column on users verified");
		} catch (e: any) {
			console.error(
				"[Migration] alpaca_account_type column error:",
				e?.message,
			);
		}

		// 26. SGB Schema & Repairs (sgb_primary_issues, sovereign_gold_bonds)
		try {
			console.log("🛠️ Verifying sovereign_gold_bonds table...");
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
			console.warn("[Migration] SGB repair sequence skipped:", e?.message);
		}

		// 27. NCD & Governance Schema Repair (Fixes SQL 42703 issue_name)
		try {
			const { runGovernanceNcdRepair } = await import(
				"../db-migrations/governance-ncd-repair"
			);
			await runGovernanceNcdRepair();
		} catch (e: any) {
			console.warn("[Migration] Governance/NCD repair skipped:", e?.message);
		}

		try {
			await migDb.execute(migSql`
          ALTER TABLE unlisted_regulatory_audit_log
            ADD COLUMN IF NOT EXISTS forensic_hash VARCHAR(64),
            ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64);
        `);
			console.log(
				"✅ forensic_hash/prev_hash columns on unlisted_regulatory_audit_log verified",
			);
		} catch (e: any) {
			console.warn(
				"[Migration] unlisted_regulatory_audit_log forensic columns skipped:",
				e?.message,
			);
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
			console.log(
				"✅ KYC & LRS columns on user_profiles & lrs_compliance_tracking verified",
			);
		} catch (e: any) {
			console.error(
				"[Migration] user_profiles & lrs_compliance_tracking KYC columns error:",
				e?.message,
			);
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
			console.log("✅ algo_signals table verified (FASP-AI v1.0 DSS)");
		} catch (e: any) {
			console.error("[Migration] algo_signals table error:", e?.message);
		}

		console.log("✅ Critical schema repairs complete");

		// ── Fix 15: model_portfolios — SEBI compliance + return optimisation columns ─
		// Adds: portfolio_code (FP-NNN), inception_date, twrr_1y/3y (SEBI-mandated),
		//       blended_benchmark_return, drift_threshold, max_drawdown_threshold,
		//       conflict_disclosure (SEBI IA Regs distributor trail disclosure).
		// NOTE: Also present in ensureSharedRouteTables() — this copy ensures the
		//       Cloud Run schema-repair job (which only calls runStartupSchemaRepairs)
		//       applies these columns on every run.
		try {
			await migDb.execute(migSql`
        ALTER TABLE model_portfolios
          ADD COLUMN IF NOT EXISTS portfolio_code           VARCHAR(20),
          ADD COLUMN IF NOT EXISTS inception_date           DATE,
          ADD COLUMN IF NOT EXISTS twrr_1y                 NUMERIC(8,4),
          ADD COLUMN IF NOT EXISTS twrr_3y                 NUMERIC(8,4),
          ADD COLUMN IF NOT EXISTS blended_benchmark_return NUMERIC(8,4),
          ADD COLUMN IF NOT EXISTS drift_threshold          NUMERIC(5,2) DEFAULT 5,
          ADD COLUMN IF NOT EXISTS max_drawdown_threshold   NUMERIC(5,2),
          ADD COLUMN IF NOT EXISTS conflict_disclosure      TEXT
      `);
			// Back-fill portfolio_code as FP-NNN using row_number over creation order
			await migDb.execute(migSql`
        UPDATE model_portfolios mp
        SET portfolio_code = sub.code
        FROM (
          SELECT id,
                 'FP-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at, id)::text, 3, '0') AS code
          FROM model_portfolios
          WHERE portfolio_code IS NULL
        ) sub
        WHERE mp.id = sub.id AND mp.portfolio_code IS NULL
      `);
			// Back-fill per-class drift thresholds
			await migDb.execute(migSql`
        UPDATE model_portfolios SET drift_threshold = 2
        WHERE (asset_class = 'debt' OR id ILIKE '%emergency%' OR id ILIKE '%liquid%') AND drift_threshold = 5
      `);
			await migDb.execute(migSql`
        UPDATE model_portfolios SET drift_threshold = 7
        WHERE (asset_class = 'thematic' OR id ILIKE '%smallcap%' OR id ILIKE '%midcap%') AND drift_threshold = 5
      `);
			// Back-fill max_drawdown_threshold by risk_profile
			await migDb.execute(migSql`
        UPDATE model_portfolios SET max_drawdown_threshold =
          CASE risk_profile
            WHEN 'conservative' THEN 8
            WHEN 'moderate'     THEN 15
            WHEN 'aggressive'   THEN 25
            ELSE 20
          END
        WHERE max_drawdown_threshold IS NULL
      `);
			console.log("  ✅ Fix 15: model_portfolios — portfolio_code, inception_date, TWRR, drift/drawdown thresholds, conflict_disclosure");
		} catch (e: any) {
			console.warn("  ⚠️  Fix 15 model_portfolios columns (non-fatal):", e.message?.slice(0, 120));
		}

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
			console.log("✅ reits schema columns verified");
		} catch (e: any) {
			console.warn("[Migration] reits column repair skipped:", e?.message);
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
			console.log("✅ invits schema columns verified");
		} catch (e: any) {
			console.warn("[Migration] invits column repair skipped:", e?.message);
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
			console.log("✅ mutual_funds comprehensive column repair complete");
		} catch (e: any) {
			console.warn(
				"[Migration] mutual_funds column repair skipped:",
				e?.message,
			);
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
			console.log("✅ bond_catalog is_active/maturity_date columns verified");
		} catch (e: any) {
			console.warn("[Migration] bond_catalog columns skipped:", e?.message);
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
			console.log("✅ error_alert_threshold table verified");
		} catch (e: any) {
			console.warn(
				"[Migration] error_alert_threshold table skipped:",
				e?.message,
			);
		}

		// ── 32. instrument_master — missing columns for PickOfTheDay strategies ──
		// Drizzle execute() does NOT support multi-statement SQL — split each statement.
		// last_price: used by price sync
		// interest_rate: used by FixedDepositStrategy ORDER BY
		// tenure_months: used by FD/Bond strategies for display
		// min_investment: used by product display
		try {
			await migDb.execute(
				migSql`ALTER TABLE instrument_master ADD COLUMN IF NOT EXISTS last_price NUMERIC(18, 4)`,
			);
		} catch (e: any) {
			console.warn(
				"[Migration] instrument_master last_price:",
				e?.message?.slice(0, 120),
			);
		}
		try {
			await migDb.execute(
				migSql`ALTER TABLE instrument_master ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(8, 4)`,
			);
		} catch (e: any) {
			console.warn(
				"[Migration] instrument_master interest_rate:",
				e?.message?.slice(0, 120),
			);
		}
		try {
			await migDb.execute(
				migSql`ALTER TABLE instrument_master ADD COLUMN IF NOT EXISTS tenure_months INTEGER`,
			);
		} catch (e: any) {
			console.warn(
				"[Migration] instrument_master tenure_months:",
				e?.message?.slice(0, 120),
			);
		}
		try {
			await migDb.execute(
				migSql`ALTER TABLE instrument_master ADD COLUMN IF NOT EXISTS min_investment NUMERIC(15, 2)`,
			);
		} catch (e: any) {
			console.warn(
				"[Migration] instrument_master min_investment:",
				e?.message?.slice(0, 120),
			);
		}
		try {
			await migDb.execute(
				migSql`CREATE INDEX IF NOT EXISTS idx_instrument_master_last_price ON instrument_master(last_price) WHERE last_price IS NOT NULL`,
			);
		} catch (e: any) {
			console.warn(
				"[Migration] instrument_master index:",
				e?.message?.slice(0, 120),
			);
		}
		try {
			await migDb.execute(
				migSql`CREATE INDEX IF NOT EXISTS idx_instrument_master_interest_rate ON instrument_master(interest_rate) WHERE interest_rate IS NOT NULL`,
			);
		} catch (e: any) {
			console.warn(
				"[Migration] instrument_master interest_rate index:",
				e?.message?.slice(0, 120),
			);
		}
		console.log("✅ instrument_master last_price column verified");

		// ── 33. goal_benchmark_mapping — ProposalBuilder missing table ────────────
		// Split into individual execute() calls — Drizzle does NOT support multi-statement SQL.
		// Removed FK REFERENCES users(id) on overridden_by to avoid FK type mismatch.
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
            overridden_by       VARCHAR,
            overridden_at       TIMESTAMPTZ,
            description         TEXT,
            created_at          TIMESTAMPTZ DEFAULT NOW(),
            updated_at          TIMESTAMPTZ DEFAULT NOW()
          )
        `);
		} catch (e: any) {
			console.warn(
				"[Migration] goal_benchmark_mapping CREATE:",
				e?.message?.slice(0, 120),
			);
		}
		try {
			await migDb.execute(
				migSql`CREATE INDEX IF NOT EXISTS idx_goal_benchmark_goal_type ON goal_benchmark_mapping(goal_type)`,
			);
		} catch (e: any) {
			console.warn(
				"[Migration] goal_benchmark_mapping idx goal_type:",
				e?.message?.slice(0, 120),
			);
		}
		try {
			await migDb.execute(
				migSql`CREATE INDEX IF NOT EXISTS idx_goal_benchmark_risk_profile ON goal_benchmark_mapping(risk_profile)`,
			);
		} catch (e: any) {
			console.warn(
				"[Migration] goal_benchmark_mapping idx risk_profile:",
				e?.message?.slice(0, 120),
			);
		}
		try {
			await migDb.execute(
				migSql`CREATE INDEX IF NOT EXISTS idx_goal_benchmark_active ON goal_benchmark_mapping(is_active)`,
			);
		} catch (e: any) {
			console.warn(
				"[Migration] goal_benchmark_mapping idx active:",
				e?.message?.slice(0, 120),
			);
		}
		try {
			await migDb.execute(migSql`
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
          ON CONFLICT DO NOTHING
        `);
		} catch (e: any) {
			console.warn(
				"[Migration] goal_benchmark_mapping seed:",
				e?.message?.slice(0, 120),
			);
		}
		console.log("✅ goal_benchmark_mapping table verified with defaults");

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
			console.log("✅ push_tokens table verified (mobile push notifications)");
		} catch (e: any) {
			console.warn("[Migration] push_tokens table skipped:", e?.message);
		}

		// ── eSign Requests: allow nullable signing-time fields (initiation records) ─
		// esign_requests was designed for post-signing records but TruthScreen inserts
		// at initiation time (before signing), so signing-specific columns must be nullable.
		// Using ADD COLUMN IF NOT EXISTS instead of ALTER COLUMN to be idempotent —
		// the columns may not exist at all in some environments.
		try {
			await migDb.execute(migSql`
          ALTER TABLE esign_requests
            ADD COLUMN IF NOT EXISTS certificate_serial VARCHAR(100),
            ADD COLUMN IF NOT EXISTS signer_aadhaar_masked VARCHAR(20),
            ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP,
            ADD COLUMN IF NOT EXISTS valid_to TIMESTAMP;
        `);
			console.log(
				"✅ esign_requests signing-time columns ensured nullable (initiation support)",
			);
		} catch (e: any) {
			console.warn(
				"[Migration] esign_requests nullable columns skipped:",
				e?.message,
			);
		}

		// ── 34. pick_watchlist & pick_price_alerts ────────────────────────────────
		// The watchlist feature tables are defined in shared schema but never ran
		// as a startup migration, causing watchlist API 500s on fresh environments.
		try {
			await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS pick_watchlist (
            id                  SERIAL PRIMARY KEY,
            user_id             VARCHAR REFERENCES users(id),
            prospect_id         VARCHAR,
            created_by_agent_id VARCHAR REFERENCES users(id),
            pick_id             INTEGER NOT NULL REFERENCES daily_picks(id),
            added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            notes               TEXT,
            price_alert_enabled BOOLEAN DEFAULT false,
            alert_threshold     DECIMAL(8, 2),
            alert_type          VARCHAR(20),
            last_alert_sent_at  TIMESTAMPTZ
          );
          CREATE INDEX IF NOT EXISTS idx_pick_watchlist_user ON pick_watchlist(user_id);
          CREATE INDEX IF NOT EXISTS idx_pick_watchlist_pick ON pick_watchlist(pick_id);

          CREATE TABLE IF NOT EXISTS pick_price_alerts (
            id                    SERIAL PRIMARY KEY,
            pick_id               INTEGER NOT NULL REFERENCES daily_picks(id),
            user_id               VARCHAR REFERENCES users(id),
            alert_type            VARCHAR(20) NOT NULL,
            trigger_price         DECIMAL(18, 4) NOT NULL,
            previous_price        DECIMAL(18, 4),
            message               TEXT,
            notification_sent     BOOLEAN DEFAULT false,
            notification_channel  VARCHAR(50),
            created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_pick_price_alerts_pick ON pick_price_alerts(pick_id);
          CREATE INDEX IF NOT EXISTS idx_pick_price_alerts_user ON pick_price_alerts(user_id);
        `);
			console.log("✅ pick_watchlist & pick_price_alerts tables verified");
		} catch (e: any) {
			console.warn(
				"[Migration] pick_watchlist/pick_price_alerts table skipped:",
				e?.message,
			);
		}

		// ── 36. portfolio_transactions — Unified Cross-Broker Transaction Ledger ────
		// New table added as part of broker-agnostic portfolio aggregation architecture.
		// Stores normalized transactions from IRIS, Alpaca, IIFL, CAS, and manual entry.
		// Idempotency enforced via (client_id, source, external_transaction_id) unique index.
		try {
			await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS portfolio_transactions (
            id                      VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            client_id               VARCHAR NOT NULL REFERENCES users(id),
            source                  VARCHAR(30) NOT NULL,
            broker_account_id       VARCHAR(100),
            transaction_type        VARCHAR(20),
            isin                    VARCHAR(12),
            symbol                  VARCHAR(50),
            scheme_name             TEXT,
            asset_class             VARCHAR(30),
            product_type            VARCHAR(30),
            trade_date              DATE,
            settlement_date         DATE,
            quantity                DECIMAL(15, 4),
            price                   DECIMAL(15, 4),
            amount                  DECIMAL(15, 2),
            charges                 DECIMAL(15, 2) DEFAULT 0,
            tax                     DECIMAL(15, 2) DEFAULT 0,
            net_amount              DECIMAL(15, 2),
            currency                VARCHAR(3) DEFAULT 'INR',
            fx_rate_to_inr          DECIMAL(10, 4) DEFAULT 1,
            external_transaction_id VARCHAR(200),
            folio_number            VARCHAR(50),
            demat_account_number    VARCHAR(20),
            source_tag              VARCHAR(20) DEFAULT 'api',
            created_at              TIMESTAMPTZ DEFAULT NOW(),
            updated_at              TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_portfolio_txns_client
            ON portfolio_transactions(client_id);
          CREATE INDEX IF NOT EXISTS idx_portfolio_txns_isin
            ON portfolio_transactions(isin) WHERE isin IS NOT NULL;
          CREATE INDEX IF NOT EXISTS idx_portfolio_txns_trade_date
            ON portfolio_transactions(trade_date);
          CREATE INDEX IF NOT EXISTS idx_portfolio_txns_source
            ON portfolio_transactions(source);
          CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_txns_idempotency
            ON portfolio_transactions(client_id, source, external_transaction_id)
            WHERE external_transaction_id IS NOT NULL;
        `);
			console.log(
				"✅ portfolio_transactions table verified (broker-agnostic ledger)",
			);
		} catch (e: any) {
			console.warn(
				"[Migration] portfolio_transactions table skipped:",
				e?.message,
			);
		}

		// ── 37. portfolio_reconciliation_log + portfolio_holding_discrepancies ────
		// Created for the Portfolio Reconciliation Engine (Phase 5).
		// Stores per-client daily reconciliation run results and flagged discrepancies.
		try {
			await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS portfolio_reconciliation_log (
            id                    SERIAL PRIMARY KEY,
            client_id             VARCHAR NOT NULL REFERENCES users(id),
            run_at                TIMESTAMPTZ NOT NULL,
            status                VARCHAR(20) NOT NULL DEFAULT 'pending', -- success | partial | error
            total_discrepancies   INTEGER NOT NULL DEFAULT 0,
            critical_count        INTEGER NOT NULL DEFAULT 0,
            high_count            INTEGER NOT NULL DEFAULT 0,
            medium_count          INTEGER NOT NULL DEFAULT 0,
            low_count             INTEGER NOT NULL DEFAULT 0,
            stale_brokers         JSONB,
            checksum              VARCHAR(16),
            engine_version        VARCHAR(30) NOT NULL DEFAULT 'recon-v1.0',
            duration_ms           INTEGER,
            discrepancy_summary   JSONB,
            created_at            TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (client_id, run_at)
          );

          CREATE INDEX IF NOT EXISTS idx_recon_log_client ON portfolio_reconciliation_log(client_id);
          CREATE INDEX IF NOT EXISTS idx_recon_log_run_at ON portfolio_reconciliation_log(run_at);
          CREATE INDEX IF NOT EXISTS idx_recon_log_status ON portfolio_reconciliation_log(status);
          CREATE INDEX IF NOT EXISTS idx_recon_log_critical ON portfolio_reconciliation_log(critical_count)
            WHERE critical_count > 0;

          CREATE TABLE IF NOT EXISTS portfolio_holding_discrepancies (
            id                    SERIAL PRIMARY KEY,
            client_id             VARCHAR NOT NULL REFERENCES users(id),
            run_at                TIMESTAMPTZ NOT NULL,
            discrepancy_type      VARCHAR(30) NOT NULL,
            severity              VARCHAR(10) NOT NULL,
            symbol                VARCHAR(100),
            isin                  VARCHAR(12),
            asset_type            VARCHAR(50),
            source                VARCHAR(50),
            ledger_value          NUMERIC(15, 4),
            broker_value          NUMERIC(15, 4),
            diff_absolute         NUMERIC(15, 4),
            diff_percent          NUMERIC(8, 4),
            description           TEXT,
            requires_review       BOOLEAN DEFAULT true,
            auto_resolvable       BOOLEAN DEFAULT false,
            resolved              BOOLEAN DEFAULT false,
            resolved_at           TIMESTAMPTZ,
            resolved_by           VARCHAR,
            resolution_note       TEXT,
            created_at            TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_holding_disc_client ON portfolio_holding_discrepancies(client_id);
          CREATE INDEX IF NOT EXISTS idx_holding_disc_severity ON portfolio_holding_discrepancies(severity);
          CREATE INDEX IF NOT EXISTS idx_holding_disc_resolved ON portfolio_holding_discrepancies(resolved);
          CREATE INDEX IF NOT EXISTS idx_holding_disc_type ON portfolio_holding_discrepancies(discrepancy_type);
        `);
			console.log(
				"✅ portfolio_reconciliation_log + portfolio_holding_discrepancies tables verified",
			);
		} catch (e: any) {
			console.warn(
				"[Migration] portfolio reconciliation tables skipped:",
				e?.message,
			);
		}

		// ── 35. Grant app user permissions on unlisted marketplace tables ─────────

		// The `postgres` user owns the unlisted_* tables but the application
		// connects as `finpro_user`.  Missing UPDATE/INSERT privilege means the
		// startup cron that marks listed companies (e.g. Swiggy) as inactive
		// silently fails with a permission error — never persisting to the DB.
		try {
			await migDb.execute(migSql`
          GRANT SELECT, INSERT, UPDATE, DELETE
            ON unlisted_companies,
               unlisted_audit_log,
               unlisted_company_status_log,
               unlisted_equity_valuation_history,
               unlisted_escrow_approvals,
               unlisted_investor_tracking,
               unlisted_price_history,
               unlisted_regulatory_audit_log,
               unlisted_risk_disclosure_acknowledgments,
               unlisted_share_lockin,
               unlisted_str_flags,
               unlisted_deals,
               unlisted_cart,
               client_unlisted_disclosure_log
            TO finpro_user;
        `);
			console.log("✅ finpro_user permissions on unlisted_* tables granted");
		} catch (e: any) {
			console.warn(
				"[Migration] finpro_user grant on unlisted tables skipped:",
				e?.message,
			);
		}
	} catch (migErr) {
		console.error("❌ Migration sequence failed (non-fatal):", migErr);
	}

	// ── Dividend & Distribution Schema Additions ──────────────────────────────
	// Adds dividend/distribution columns to all relevant instrument tables.
	// Source: IndianAPI.in /corporate_actions endpoint.
	try {
		const { db: migDb } = await import("../db");
		const { sql: migSql } = await import("drizzle-orm");

		// listed_stocks: equity dividend data
		await migDb.execute(migSql`
      ALTER TABLE listed_stocks
        ADD COLUMN IF NOT EXISTS dividend_per_share             NUMERIC(12,4),
        ADD COLUMN IF NOT EXISTS dividend_yield                 NUMERIC(8,4),
        ADD COLUMN IF NOT EXISTS dividend_frequency             VARCHAR(20),
        ADD COLUMN IF NOT EXISTS last_dividend_date             DATE,
        ADD COLUMN IF NOT EXISTS last_dividend_ex_date          DATE,
        ADD COLUMN IF NOT EXISTS last_dividend_record_date      DATE,
        ADD COLUMN IF NOT EXISTS last_dividend_percent          VARCHAR(20),
        ADD COLUMN IF NOT EXISTS last_dividend_details          TEXT,
        ADD COLUMN IF NOT EXISTS dividend_payout_ratio          NUMERIC(8,4),
        ADD COLUMN IF NOT EXISTS dividend_updated_at            TIMESTAMPTZ;
    `);
		console.log("✅ listed_stocks dividend columns added");

		// stock_financial_metrics: historical dividends per P&L row
		await migDb.execute(migSql`
      ALTER TABLE stock_financial_metrics
        ADD COLUMN IF NOT EXISTS dividend_per_share             NUMERIC(12,4),
        ADD COLUMN IF NOT EXISTS dividend_payout_ratio          NUMERIC(8,4),
        ADD COLUMN IF NOT EXISTS dividend_yield_pct             NUMERIC(8,4);
    `);
		console.log("✅ stock_financial_metrics dividend columns added");

		// reits: REIT distributions (not dividends — taxed differently)
		await migDb.execute(migSql`
      ALTER TABLE reits
        ADD COLUMN IF NOT EXISTS distribution_per_unit          NUMERIC(12,4),
        ADD COLUMN IF NOT EXISTS distribution_yield             NUMERIC(8,4),
        ADD COLUMN IF NOT EXISTS distribution_frequency         VARCHAR(20),
        ADD COLUMN IF NOT EXISTS last_distribution_date         DATE,
        ADD COLUMN IF NOT EXISTS last_distribution_ex_date      DATE,
        ADD COLUMN IF NOT EXISTS last_distribution_record_date  DATE,
        ADD COLUMN IF NOT EXISTS last_distribution_details      TEXT,
        ADD COLUMN IF NOT EXISTS distribution_updated_at        TIMESTAMPTZ;
    `);
		console.log("✅ reits distribution columns added");

		// invits: InvIT distributions
		await migDb.execute(migSql`
      ALTER TABLE invits
        ADD COLUMN IF NOT EXISTS distribution_per_unit          NUMERIC(12,4),
        ADD COLUMN IF NOT EXISTS distribution_yield             NUMERIC(8,4),
        ADD COLUMN IF NOT EXISTS distribution_frequency         VARCHAR(20),
        ADD COLUMN IF NOT EXISTS last_distribution_date         DATE,
        ADD COLUMN IF NOT EXISTS last_distribution_ex_date      DATE,
        ADD COLUMN IF NOT EXISTS last_distribution_record_date  DATE,
        ADD COLUMN IF NOT EXISTS last_distribution_details      TEXT,
        ADD COLUMN IF NOT EXISTS distribution_updated_at        TIMESTAMPTZ;
    `);
		console.log("✅ invits distribution columns added");

		// mutual_funds: dividends (IDCW — Income Distribution cum Capital Withdrawal)
		await migDb.execute(migSql`
      ALTER TABLE mutual_funds
        ADD COLUMN IF NOT EXISTS idcw_per_unit                  NUMERIC(12,4),
        ADD COLUMN IF NOT EXISTS idcw_frequency                 VARCHAR(20),
        ADD COLUMN IF NOT EXISTS last_idcw_date                 DATE,
        ADD COLUMN IF NOT EXISTS last_idcw_ex_date              DATE,
        ADD COLUMN IF NOT EXISTS last_idcw_record_date          DATE,
        ADD COLUMN IF NOT EXISTS last_idcw_details              TEXT,
        ADD COLUMN IF NOT EXISTS idcw_updated_at                TIMESTAMPTZ;
    `);
		console.log("✅ mutual_funds IDCW columns added");

		// corporate_actions_cache: deduplicated dividend history for all instruments
		await migDb.execute(migSql`
      CREATE TABLE IF NOT EXISTS corporate_actions_cache (
        id                    SERIAL PRIMARY KEY,
        symbol                VARCHAR(30) NOT NULL,
        exchange              VARCHAR(10) NOT NULL DEFAULT 'NSE',
        action_type           VARCHAR(20) NOT NULL, -- 'dividend' | 'split' | 'bonus' | 'rights'
        record_date           DATE,
        ex_date               DATE,
        amount_per_share      NUMERIC(12,4),
        ratio                 VARCHAR(30),
        percentage            VARCHAR(20),
        details               TEXT,
        raw_data              JSONB,
        source                VARCHAR(20) DEFAULT 'indian_api',
        fetched_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_corp_actions_symbol ON corporate_actions_cache(symbol, action_type);
      CREATE INDEX IF NOT EXISTS idx_corp_actions_ex_date ON corporate_actions_cache(ex_date DESC);
    `);
		console.log("✅ corporate_actions_cache table created");

	} catch (divErr: any) {
		console.warn("[Migration] Dividend column additions skipped (non-fatal):", divErr?.message);
	}

	// ── Picks data integrity backfill ────────────────────────────────────────
	// Fixes data quality issues in the daily_picks table:
	//  1. NULL time_horizon rows → 'medium_term'
	//  2. confidence_score stored as raw quant integer (e.g. 8600) → 0-100
	//  3. Non-canonical horizon values: 'short'→'short_term', 'medium'→'medium_term',
	//     'long'→'long_term'. 'intraday' is kept as-is (now has frontend mapping).
	try {
		const { db: migDb2 } = await import("../db");
		const { sql: migSql2 } = await import("drizzle-orm");
		await migDb2.execute(migSql2`
      -- Backfill NULL time_horizon rows
      UPDATE daily_picks
      SET    time_horizon = 'medium_term'
      WHERE  time_horizon IS NULL;

      -- Normalise non-canonical horizon values (legacy short/medium/long without _term)
      UPDATE daily_picks
      SET    time_horizon = CASE time_horizon
               WHEN 'short'  THEN 'short_term'
               WHEN 'medium' THEN 'medium_term'
               WHEN 'long'   THEN 'long_term'
               ELSE time_horizon
             END
      WHERE  time_horizon IN ('short', 'medium', 'long');

      -- Clamp out-of-range confidence_score: values > 100 are raw integer scores
      -- (e.g. 8600 from quant scorer) that were never divided by 100.
      UPDATE daily_picks
      SET    confidence_score = GREATEST(60, LEAST(100, ROUND(confidence_score::numeric / 100)::int))
      WHERE  confidence_score > 100;
    `);
		console.log("✅ daily_picks data integrity backfill complete (horizon normalised + confidence_score)");
	} catch (picksErr: any) {
		console.warn("[Migration] daily_picks backfill skipped (non-fatal):", picksErr?.message);
	}

	// ── Engine Audit Fix #6 — 2026-06-27: model_portfolios table + seed ──────
	// Creates the model_portfolios table (replacing static frontend data) and
	// seeds 5 representative portfolios. INSERT ON CONFLICT DO NOTHING ensures
	// existing rows (with live computed metrics) are never overwritten.
	try {
		const { db: mpDb } = await import("../db");
		const { sql: mpSql } = await import("drizzle-orm");
		// ── Step 1: CREATE TABLE (separate execute — Neon HTTP driver does not support
		//   multi-statement SQL in a single call; combining CREATE + INSERT causes
		//   "Failed query" and silently skips the entire migration block).
		await mpDb.execute(mpSql`
      CREATE TABLE IF NOT EXISTS model_portfolios (
        id                    VARCHAR PRIMARY KEY,
        name                  VARCHAR NOT NULL,
        tagline               VARCHAR,
        risk_profile          VARCHAR NOT NULL,
        asset_class           VARCHAR NOT NULL,
        sub_category          VARCHAR,
        goals                 JSONB    DEFAULT '[]'::jsonb,
        min_investment        NUMERIC  DEFAULT 5000,
        time_horizon          VARCHAR,
        benchmark_name        VARCHAR,
        last_rebalanced       VARCHAR,
        rebalancing_frequency VARCHAR  DEFAULT 'quarterly',
        total_holdings        INTEGER  DEFAULT 0,
        highlight             VARCHAR,
        icon                  VARCHAR  DEFAULT '📊',
        is_published          BOOLEAN  DEFAULT TRUE,
        is_featured           BOOLEAN  DEFAULT FALSE,
        is_new                BOOLEAN  DEFAULT FALSE,
        allocation            JSONB    DEFAULT '[]'::jsonb,
        holdings              JSONB    DEFAULT '[]'::jsonb,
        rebalancing_history   JSONB    DEFAULT '[]'::jsonb,
        cagr_1y               NUMERIC,
        cagr_3y               NUMERIC,
        cagr_5y               NUMERIC,
        benchmark_cagr_1y     NUMERIC,
        sharpe_ratio          NUMERIC,
        max_drawdown          NUMERIC,
        volatility            NUMERIC,
        beta                  NUMERIC,
        alpha                 NUMERIC,
        ai_insight            JSONB,
        ai_insight_updated_at TIMESTAMP,
        -- Quant Alpha Engine columns (FASP-AI-v2.0) — must match Drizzle schema
        drift_score           INTEGER   DEFAULT 0,
        drift_details         JSONB     DEFAULT '[]'::jsonb,
        quant_engine_version  VARCHAR   DEFAULT 'FASP-AI-v2.0',
        last_quant_run        TIMESTAMP,
        engine_version        VARCHAR  DEFAULT '1.0.0',
        created_at            TIMESTAMP DEFAULT NOW(),
        updated_at            TIMESTAMP DEFAULT NOW(),
        source                VARCHAR  DEFAULT 'api'
      )
    `);
		console.log("✅ model_portfolios table ensured (engine audit Fix #6)");

		// ── Step 2: Ensure quant alpha columns exist on pre-existing tables
		//   (ADD COLUMN IF NOT EXISTS is a no-op if already present)
		await mpDb.execute(mpSql`
      ALTER TABLE model_portfolios
        ADD COLUMN IF NOT EXISTS drift_score          INTEGER   DEFAULT 0,
        ADD COLUMN IF NOT EXISTS drift_details        JSONB     DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS quant_engine_version VARCHAR   DEFAULT 'FASP-AI-v2.0',
        ADD COLUMN IF NOT EXISTS last_quant_run       TIMESTAMP
    `);

		// ── Step 3: Ensure indexes exist
		await mpDb.execute(mpSql`CREATE INDEX IF NOT EXISTS idx_model_portfolios_risk      ON model_portfolios (risk_profile)`);
		await mpDb.execute(mpSql`CREATE INDEX IF NOT EXISTS idx_model_portfolios_asset     ON model_portfolios (asset_class)`);
		await mpDb.execute(mpSql`CREATE INDEX IF NOT EXISTS idx_model_portfolios_published ON model_portfolios (is_published)`);
		await mpDb.execute(mpSql`CREATE INDEX IF NOT EXISTS idx_model_portfolios_drift     ON model_portfolios (drift_score DESC)`);

		// ── Step 4: Seed representative portfolios (separate execute — multi-statement
		//   SQL not allowed in single Neon HTTP execute call).
		//   INSERT ON CONFLICT DO NOTHING: never overwrites existing rows with live metrics.
		await mpDb.execute(mpSql`
      INSERT INTO model_portfolios (id, name, tagline, risk_profile, asset_class, goals, min_investment, time_horizon, benchmark_name, last_rebalanced, rebalancing_frequency, total_holdings, highlight, icon, is_featured, allocation, holdings)
      VALUES
        ('all-weather-india', 'All Weather India', 'Stays resilient across economic cycles', 'all_weather', 'hybrid',
          '["wealth_preservation","steady_growth"]', 10000, '5+ years', 'Nifty 500', TO_CHAR(NOW() - INTERVAL '10 days', 'YYYY-MM-DD'), 'quarterly', 8, 'Designed to perform in all market conditions', '🌦️', TRUE,
          '[{"type":"equity","label":"Indian Equity","weight":40},{"type":"debt","label":"Govt Bonds","weight":30},{"type":"gold","label":"Gold","weight":15},{"type":"reit","label":"REIT/InvIT","weight":15}]',
          '[{"name":"Nifty 50 Index Fund","isin":"INF204KA1B73","weight":25,"type":"equity"},{"name":"Nifty Next 50","isin":"INF0J9K01AL0","weight":15,"type":"equity"},{"name":"Gilt Fund","isin":"INF174KA1JI7","weight":20,"type":"debt"},{"name":"SDL Fund","isin":"INF194KA1BW2","weight":10,"type":"debt"},{"name":"Gold ETF","isin":"INF760K01EG5","weight":15,"type":"gold"},{"name":"Embassy REIT","isin":"INE251K01021","weight":10,"type":"reit"},{"name":"Liquid Fund","isin":"INF174KA1JP2","weight":5,"type":"liquid"}]'
        ),
        ('equity-momentum-india', 'Equity Momentum India', 'Capitalise on strong market trends', 'aggressive', 'equity',
          '["capital_appreciation","wealth_creation"]', 25000, '7+ years', 'Nifty 200 Momentum 30', TO_CHAR(NOW() - INTERVAL '5 days', 'YYYY-MM-DD'), 'quarterly', 10, 'Factor-based momentum investing', '🚀', TRUE,
          '[{"type":"large_cap","label":"Large Cap","weight":40},{"type":"mid_cap","label":"Mid Cap","weight":35},{"type":"small_cap","label":"Small Cap","weight":25}]',
          '[{"name":"Axis Bluechip Fund","isin":"INF846K01EW2","weight":20,"type":"equity"},{"name":"SBI Magnum Midcap","isin":"INF200K01FI3","weight":20,"type":"equity"},{"name":"Nippon India Small Cap","isin":"INF204K01R30","weight":15,"type":"equity"},{"name":"ICICI Pru Momentum","isin":"INF109K01HU0","weight":15,"type":"equity"},{"name":"Kotak Emerging Equity","isin":"INF174K01904","weight":15,"type":"equity"},{"name":"DSP Midcap","isin":"INF740K01145","weight":15,"type":"equity"}]'
        ),
        ('conservative-income', 'Conservative Income', 'Regular income with capital safety', 'conservative', 'debt',
          '["regular_income","capital_preservation"]', 5000, '1-3 years', 'CRISIL Short Term Bond Index', TO_CHAR(NOW() - INTERVAL '15 days', 'YYYY-MM-DD'), 'semi_annual', 6, 'Low-risk monthly income generator', '💰', FALSE,
          '[{"type":"debt","label":"Short Duration","weight":40},{"type":"debt","label":"Corporate Bond","weight":30},{"type":"debt","label":"Liquid","weight":20},{"type":"gold","label":"Gold","weight":10}]',
          '[{"name":"HDFC Short Term Debt","isin":"INF179K01XB6","weight":25,"type":"debt"},{"name":"Kotak Bond Short Term","isin":"INF174K01VB9","weight":25,"type":"debt"},{"name":"ICICI Pru Corporate Bond","isin":"INF109K01XS7","weight":20,"type":"debt"},{"name":"SBI Liquid Fund","isin":"INF200K01FT1","weight":20,"type":"debt"},{"name":"Gold ETF","isin":"INF760K01EG5","weight":10,"type":"gold"}]'
        ),
        ('india-growth', 'India Growth Portfolio', 'Long-term wealth with diversified equity', 'moderate', 'equity',
          '["long_term_wealth","retirement"]', 15000, '5-7 years', 'Nifty 500', TO_CHAR(NOW() - INTERVAL '8 days', 'YYYY-MM-DD'), 'quarterly', 9, 'Balanced equity across cap sizes', '📈', FALSE,
          '[{"type":"large_cap","label":"Large Cap","weight":50},{"type":"mid_cap","label":"Mid Cap","weight":30},{"type":"international","label":"International","weight":10},{"type":"debt","label":"Debt","weight":10}]',
          '[{"name":"Parag Parikh Flexi Cap","isin":"INF879O01027","weight":25,"type":"equity"},{"name":"Mirae Asset Large Cap","isin":"INF769K01010","weight":25,"type":"equity"},{"name":"Axis Midcap","isin":"INF846K01ES1","weight":20,"type":"equity"},{"name":"ICICI Pru US Bluechip","isin":"INF109KA1YC2","weight":10,"type":"international"},{"name":"HDFC Corp Bond","isin":"INF179K01WD2","weight":10,"type":"debt"},{"name":"Liquid Fund","isin":"INF200K01FT1","weight":10,"type":"debt"}]'
        ),
        ('tax-saver-elss', 'Tax Saver ELSS Portfolio', 'Tax savings with long-term growth under 80C', 'moderate', 'equity',
          '["tax_saving","wealth_creation"]', 500, '3+ years (lock-in)', 'Nifty 500', TO_CHAR(NOW() - INTERVAL '20 days', 'YYYY-MM-DD'), 'annual', 5, 'ELSS funds for ₹1.5L tax deduction', '🧾', FALSE,
          '[{"type":"large_cap","label":"Large Cap ELSS","weight":40},{"type":"multi_cap","label":"Multi Cap ELSS","weight":35},{"type":"mid_cap","label":"Mid Cap ELSS","weight":25}]',
          '[{"name":"Mirae Asset Tax Saver","isin":"INF769K01238","weight":30,"type":"equity"},{"name":"Axis Long Term Equity","isin":"INF846K01EG5","weight":25,"type":"equity"},{"name":"Parag Parikh Tax Saver","isin":"INF879O01779","weight":25,"type":"equity"},{"name":"DSP Tax Saver","isin":"INF740K01699","weight":20,"type":"equity"}]'
        ),

        ('global-diversifier', 'Global Diversifier', 'India + global exposure for true diversification', 'moderate', 'international',
          '["global_diversification","currency_hedge","wealth_creation"]', 10000, '5+ years', 'MSCI World Index', TO_CHAR(NOW() - INTERVAL '7 days', 'YYYY-MM-DD'), 'quarterly', 8, 'Invest across US, Europe & Asia alongside India', '🌍', TRUE,
          '[{"type":"indian_equity","label":"Indian Equity","weight":40},{"type":"us_equity","label":"US Equity","weight":30},{"type":"global_equity","label":"Global ex-US","weight":20},{"type":"debt","label":"Debt","weight":10}]',
          '[{"name":"Parag Parikh Flexi Cap","isin":"INF879O01027","weight":20,"type":"equity"},{"name":"ICICI Pru US Bluechip","isin":"INF109KA1YC2","weight":20,"type":"international"},{"name":"Motilal Oswal Nasdaq 100","isin":"INF247L01024","weight":15,"type":"international"},{"name":"DSP World Mining","isin":"INF740K01EB5","weight":10,"type":"international"},{"name":"Kotak International REIT","isin":"INF174KA1RW1","weight":10,"type":"international"},{"name":"Nifty 50 Index Fund","isin":"INF204KA1B73","weight":15,"type":"equity"},{"name":"Short Duration Debt","isin":"INF179K01XB6","weight":10,"type":"debt"}]'
        ),
        ('small-cap-alpha', 'Small Cap Alpha', 'High-conviction small caps for long-term alpha', 'aggressive', 'equity',
          '["capital_appreciation","wealth_creation"]', 25000, '7+ years', 'Nifty Smallcap 250', TO_CHAR(NOW() - INTERVAL '3 days', 'YYYY-MM-DD'), 'quarterly', 8, 'Bottom-up small cap selection with quality filter', '⚡', FALSE,
          '[{"type":"small_cap","label":"Small Cap","weight":70},{"type":"mid_cap","label":"Mid Cap","weight":20},{"type":"liquid","label":"Liquid","weight":10}]',
          '[{"name":"Nippon India Small Cap","isin":"INF204K01R30","weight":25,"type":"equity"},{"name":"SBI Small Cap Fund","isin":"INF200K01EJ3","weight":20,"type":"equity"},{"name":"Axis Small Cap","isin":"INF846K01EY8","weight":15,"type":"equity"},{"name":"Kotak Small Cap","isin":"INF174K01GK5","weight":10,"type":"equity"},{"name":"HDFC Small Cap","isin":"INF179K01TT4","weight":20,"type":"equity"},{"name":"Liquid Fund","isin":"INF200K01FT1","weight":10,"type":"debt"}]'
        ),
        ('reit-invit-income', 'REIT & InvIT Income', 'Real asset income through listed trusts', 'moderate', 'alternatives',
          '["regular_income","real_asset_exposure","inflation_hedge"]', 15000, '3-5 years', 'Nifty REITs & InvITs Index', TO_CHAR(NOW() - INTERVAL '12 days', 'YYYY-MM-DD'), 'semi_annual', 7, 'Quarterly distributions from premium real assets', '🏢', TRUE,
          '[{"type":"reit","label":"Office REIT","weight":40},{"type":"reit","label":"Retail REIT","weight":20},{"type":"invit","label":"InvIT","weight":30},{"type":"liquid","label":"Liquid","weight":10}]',
          '[{"name":"Embassy Office Parks REIT","isin":"INE251K01021","weight":25,"type":"reit"},{"name":"Mindspace Business Parks REIT","isin":"INE037FC01012","weight":20,"type":"reit"},{"name":"Brookfield India REIT","isin":"INE0JD801015","weight":15,"type":"reit"},{"name":"IndiGrid InvIT","isin":"INE219O01021","weight":20,"type":"invit"},{"name":"IRB InvIT","isin":"INE500L20022","weight":10,"type":"invit"},{"name":"Liquid Fund","isin":"INF200K01FT1","weight":10,"type":"liquid"}]'
        ),
        ('digital-gold-accumulator', 'Digital Gold Accumulator', 'Systematic gold accumulation without physical storage', 'conservative', 'gold',
          '["inflation_hedge","wealth_preservation","goal_planning"]', 1000, '3+ years', 'MCX Gold', TO_CHAR(NOW() - INTERVAL '18 days', 'YYYY-MM-DD'), 'annual', 5, 'Sovereign & digital gold for every Indian household', '🥇', FALSE,
          '[{"type":"sgb","label":"Sovereign Gold Bonds","weight":50},{"type":"gold_etf","label":"Gold ETFs","weight":30},{"type":"gold_fund","label":"Gold Savings Fund","weight":20}]',
          '[{"name":"SGB 2024-25 Series I","isin":"IN0020240021","weight":30,"type":"sgb"},{"name":"SGB 2023-24 Series IV","isin":"IN0020240013","weight":20,"type":"sgb"},{"name":"Nippon India Gold ETF","isin":"INF204KA1I34","weight":20,"type":"gold_etf"},{"name":"HDFC Gold ETF","isin":"INF179K01V44","weight":10,"type":"gold_etf"},{"name":"Nippon Gold Savings Fund","isin":"INF204K01TW4","weight":20,"type":"gold_fund"}]'
        ),
        ('debt-ladder', 'Debt Ladder Portfolio', 'Systematic maturity ladder for predictable income', 'conservative', 'debt',
          '["regular_income","capital_preservation","liquidity"]', 25000, '2-5 years', 'CRISIL Composite Bond Index', TO_CHAR(NOW() - INTERVAL '25 days', 'YYYY-MM-DD'), 'annual', 8, 'Staggered maturities for consistent cash flows', '📊', FALSE,
          '[{"type":"liquid","label":"Liquid (0-3M)","weight":15},{"type":"ultra_short","label":"Ultra Short (3-6M)","weight":20},{"type":"low_duration","label":"Low Duration (6-12M)","weight":25},{"type":"short_duration","label":"Short Duration (1-3Y)","weight":25},{"type":"medium_duration","label":"Medium Duration (3-5Y)","weight":15}]',
          '[{"name":"SBI Liquid Fund","isin":"INF200K01FT1","weight":15,"type":"liquid"},{"name":"HDFC Ultra Short Term","isin":"INF179K01XM3","weight":20,"type":"debt"},{"name":"Kotak Low Duration","isin":"INF174K01UJ8","weight":25,"type":"debt"},{"name":"HDFC Short Term Debt","isin":"INF179K01XB6","weight":25,"type":"debt"},{"name":"ICICI Pru Medium Term Bond","isin":"INF109K01YR5","weight":15,"type":"debt"}]'
        ),
        ('balanced-advantage', 'Balanced Advantage Portfolio', 'Dynamic equity-debt mix adapting to market valuations', 'moderate', 'hybrid',
          '["steady_growth","downside_protection","long_term_wealth"]', 10000, '3-5 years', 'CRISIL Hybrid 50+50 Moderate Index', TO_CHAR(NOW() - INTERVAL '6 days', 'YYYY-MM-DD'), 'quarterly', 7, 'Auto-rebalances between equity and debt dynamically', '⚖️', TRUE,
          '[{"type":"equity","label":"Equity (Dynamic)","weight":50},{"type":"arbitrage","label":"Arbitrage","weight":20},{"type":"debt","label":"Debt","weight":30}]',
          '[{"name":"HDFC Balanced Advantage","isin":"INF179K01WE0","weight":25,"type":"hybrid"},{"name":"ICICI Pru Balanced Advantage","isin":"INF109K01XQ1","weight":25,"type":"hybrid"},{"name":"Edelweiss BAF","isin":"INF754K01KT7","weight":20,"type":"hybrid"},{"name":"DSP Dynamic Asset Allocation","isin":"INF740K01GI6","weight":15,"type":"hybrid"},{"name":"HDFC Corp Bond","isin":"INF179K01WD2","weight":15,"type":"debt"}]'
        ),
        ('childrens-education', 'Children\'s Education Portfolio', 'Build a corpus for your child\'s future education', 'moderate', 'goal_based',
          '["education_planning","goal_planning","wealth_creation"]', 5000, '8-15 years', 'Nifty 500', TO_CHAR(NOW() - INTERVAL '14 days', 'YYYY-MM-DD'), 'annual', 8, 'Goal-linked investing for education milestones', '🎓', FALSE,
          '[{"type":"equity","label":"Equity Growth","weight":60},{"type":"hybrid","label":"Hybrid","weight":20},{"type":"debt","label":"Debt Safety Net","weight":20}]',
          '[{"name":"Axis Children\'s Gift Fund","isin":"INF846K01AC5","weight":25,"type":"equity"},{"name":"HDFC Children\'s Gift Fund","isin":"INF179K01TV6","weight":20,"type":"equity"},{"name":"Parag Parikh Flexi Cap","isin":"INF879O01027","weight":20,"type":"equity"},{"name":"SBI Magnum Balanced","isin":"INF200K01RF6","weight":15,"type":"hybrid"},{"name":"ICICI Pru Corp Bond","isin":"INF109K01XS7","weight":10,"type":"debt"},{"name":"Gilt Fund","isin":"INF174KA1JI7","weight":10,"type":"debt"}]'
        ),
        ('retirement-builder', 'Retirement Builder', 'Systematic wealth accumulation for a comfortable retirement', 'moderate', 'goal_based',
          '["retirement","long_term_wealth","regular_income"]', 5000, '10-25 years', 'Nifty 500', TO_CHAR(NOW() - INTERVAL '9 days', 'YYYY-MM-DD'), 'annual', 9, 'Glide path from growth to income as you age', '🏖️', TRUE,
          '[{"type":"equity","label":"Equity (Growth Phase)","weight":55},{"type":"hybrid","label":"Hybrid","weight":20},{"type":"debt","label":"Debt (Safety)","weight":20},{"type":"gold","label":"Gold","weight":5}]',
          '[{"name":"HDFC Retirement Savings - Equity","isin":"INF179K01VS9","weight":25,"type":"equity"},{"name":"Tata Retirement Savings Progressive","isin":"INF277K01Z10","weight":20,"type":"equity"},{"name":"Franklin India Prima Plus","isin":"INF090I01239","weight":15,"type":"equity"},{"name":"ICICI Pru Balanced Advantage","isin":"INF109K01XQ1","weight":15,"type":"hybrid"},{"name":"HDFC Short Term Debt","isin":"INF179K01XB6","weight":15,"type":"debt"},{"name":"SBI Gilt Fund","isin":"INF200K01EH7","weight":5,"type":"debt"},{"name":"Nippon Gold ETF","isin":"INF204KA1I34","weight":5,"type":"gold"}]'
        ),
        ('dividend-yield', 'Dividend Yield Portfolio', 'Regular dividends from quality dividend-paying stocks', 'moderate', 'equity',
          '["regular_income","dividend_income","capital_appreciation"]', 20000, '3-5 years', 'Nifty Dividend Opportunities 50', TO_CHAR(NOW() - INTERVAL '11 days', 'YYYY-MM-DD'), 'semi_annual', 8, 'High dividend yield stocks with strong fundamentals', '💵', FALSE,
          '[{"type":"large_cap_dividend","label":"Large Cap High Yield","weight":55},{"type":"mid_cap_dividend","label":"Mid Cap Yield","weight":25},{"type":"debt","label":"Debt Buffer","weight":20}]',
          '[{"name":"HDFC Dividend Yield Fund","isin":"INF179K01XH3","weight":25,"type":"equity"},{"name":"ICICI Pru Dividend Yield Equity","isin":"INF109K01XJ4","weight":20,"type":"equity"},{"name":"UTI Dividend Yield","isin":"INF789F01GS0","weight":15,"type":"equity"},{"name":"Templeton India Equity Income","isin":"INF090I01JC5","weight":15,"type":"equity"},{"name":"SBI Magnum Equity ESG","isin":"INF200K01TY4","weight":10,"type":"equity"},{"name":"HDFC Short Term Debt","isin":"INF179K01XB6","weight":15,"type":"debt"}]'
        ),
        ('nri-india-opportunity', 'NRI India Opportunity', 'India-focused portfolio designed for NRI investors', 'moderate', 'equity',
          '["india_exposure","wealth_creation","currency_diversification"]', 50000, '5-10 years', 'Nifty 500', TO_CHAR(NOW() - INTERVAL '4 days', 'YYYY-MM-DD'), 'quarterly', 8, 'Optimised for NRI tax structures and repatriation', '✈️', FALSE,
          '[{"type":"large_cap","label":"Large Cap India","weight":45},{"type":"mid_cap","label":"Mid Cap India","weight":25},{"type":"debt","label":"Debt/Liquid","weight":15},{"type":"sgb","label":"Sovereign Gold","weight":15}]',
          '[{"name":"Nifty 50 Index Fund","isin":"INF204KA1B73","weight":25,"type":"equity"},{"name":"Mirae Asset Large Cap","isin":"INF769K01010","weight":20,"type":"equity"},{"name":"Kotak Emerging Equity","isin":"INF174K01904","weight":15,"type":"equity"},{"name":"Axis Midcap","isin":"INF846K01ES1","weight":10,"type":"equity"},{"name":"HDFC Short Term Debt","isin":"INF179K01XB6","weight":15,"type":"debt"},{"name":"SGB 2024-25 Series I","isin":"IN0020240021","weight":15,"type":"sgb"}]'
        ),

        ('pure-debt-portfolio', 'Pure Debt Portfolio', 'Capital safety with superior debt returns vs FD', 'conservative', 'debt',
          '["capital_preservation","regular_income","fd_alternative"]', 10000, '1-5 years', 'CRISIL Composite Bond Index', TO_CHAR(NOW() - INTERVAL '2 days', 'YYYY-MM-DD'), 'semi_annual', 8, 'Better than FD returns with sovereign & AAA safety', '🔐', TRUE,
          '[{"type":"gilt","label":"Government Securities","weight":30},{"type":"corporate_bond","label":"AAA Corporate Bonds","weight":35},{"type":"sdl","label":"State Dev Loans","weight":20},{"type":"liquid","label":"Liquid Buffer","weight":15}]',
          '[{"name":"HDFC Gilt Fund","isin":"INF179K01YK8","weight":15,"type":"gilt"},{"name":"SBI Magnum Gilt","isin":"INF200K01EH7","weight":15,"type":"gilt"},{"name":"ICICI Pru Corporate Bond","isin":"INF109K01XS7","weight":20,"type":"corporate_bond"},{"name":"Axis Corporate Debt","isin":"INF846K01FJ6","weight":15,"type":"corporate_bond"},{"name":"BHARAT Bond ETF Apr 2032","isin":"INF464K01000","weight":20,"type":"corporate_bond"},{"name":"SBI Liquid Fund","isin":"INF200K01FT1","weight":15,"type":"liquid"}]'
        ),
        ('corporate-treasury', 'Corporate Treasury Portfolio', 'Optimal parking for corporate surplus cash', 'conservative', 'debt',
          '["capital_preservation","liquidity","treasury_management"]', 100000, '1 day - 6 months', 'CRISIL Liquid Fund Index', TO_CHAR(NOW() - INTERVAL '1 days', 'YYYY-MM-DD'), 'monthly', 6, 'Zero-risk cash management for corporate treasuries', '🏦', FALSE,
          '[{"type":"overnight","label":"Overnight","weight":20},{"type":"liquid","label":"Liquid","weight":35},{"type":"ultra_short","label":"Ultra Short Term","weight":30},{"type":"money_market","label":"Money Market","weight":15}]',
          '[{"name":"Nippon Overnight Fund","isin":"INF204KA1T97","weight":20,"type":"liquid"},{"name":"HDFC Liquid Fund","isin":"INF179K01WF7","weight":20,"type":"liquid"},{"name":"SBI Liquid Fund","isin":"INF200K01FT1","weight":15,"type":"liquid"},{"name":"Kotak Ultra Short Duration","isin":"INF174K01UJ8","weight":20,"type":"debt"},{"name":"ICICI Pru Ultra Short Term","isin":"INF109K01YS3","weight":10,"type":"debt"},{"name":"Aditya Birla Money Market","isin":"INF084M01FD2","weight":15,"type":"debt"}]'
        ),



        ('passive-index', 'Passive Index Portfolio', 'Low-cost market returns tracking Nifty 50 & Next 50', 'moderate', 'equity',
          '["wealth_creation","long_term_wealth","low_cost"]', 500, '5+ years', 'Nifty 500', TO_CHAR(NOW() - INTERVAL '1 days', 'YYYY-MM-DD'), 'annual', 4, 'Zero fund manager risk — just buy the market', '🗂️', TRUE,
          '[{"type":"large_cap","label":"Nifty 50","weight":60},{"type":"large_cap","label":"Nifty Next 50","weight":30},{"type":"liquid","label":"Liquid Buffer","weight":10}]',
          '[{"name":"UTI Nifty 50 Index Fund","isin":"INF789FC1G50","weight":35,"type":"equity"},{"name":"HDFC Nifty 50 Index","isin":"INF179K01XG5","weight":25,"type":"equity"},{"name":"Motilal Oswal Nifty Next 50","isin":"INF247L01032","weight":30,"type":"equity"},{"name":"SBI Liquid Fund","isin":"INF200K01FT1","weight":10,"type":"liquid"}]'
        ),
        ('value-investing', 'Value Investing Portfolio', 'Buy great businesses at fair prices for long-term wealth', 'moderate', 'equity',
          '["capital_appreciation","wealth_creation","contrarian"]', 15000, '5-7 years', 'Nifty 500 Value 50', TO_CHAR(NOW() - INTERVAL '3 days', 'YYYY-MM-DD'), 'semi_annual', 8, 'Low P/E, P/B with strong balance sheets', '💎', TRUE,
          '[{"type":"value_large","label":"Large Cap Value","weight":50},{"type":"value_mid","label":"Mid Cap Value","weight":30},{"type":"liquid","label":"Cash & Liquid","weight":20}]',
          '[{"name":"ICICI Pru Value Discovery","isin":"INF109K01BG0","weight":25,"type":"equity"},{"name":"Parag Parikh Flexi Cap","isin":"INF879O01027","weight":20,"type":"equity"},{"name":"Templeton India Value","isin":"INF090I01JD3","weight":15,"type":"equity"},{"name":"Quantum Long Term Equity Value","isin":"INF082J01019","weight":15,"type":"equity"},{"name":"HDFC Capital Builder Value","isin":"INF179K01WP3","weight":15,"type":"equity"},{"name":"Liquid Fund","isin":"INF200K01FT1","weight":10,"type":"liquid"}]'
        ),
        ('digital-india-tech', 'Digital India & Technology', 'Ride India''s digital economy boom — IT, AI & FinTech', 'aggressive', 'thematic',
          '["capital_appreciation","thematic","digital_economy"]', 10000, '5+ years', 'Nifty IT Index', TO_CHAR(NOW() - INTERVAL '2 days', 'YYYY-MM-DD'), 'quarterly', 8, 'India''s $1T digital economy opportunity', '💻', TRUE,
          '[{"type":"it_services","label":"IT Services","weight":45},{"type":"fintech","label":"FinTech & Payments","weight":25},{"type":"internet","label":"Internet & Platforms","weight":20},{"type":"liquid","label":"Liquid","weight":10}]',
          '[{"name":"ICICI Pru Technology Fund","isin":"INF109K01FJ3","weight":20,"type":"equity"},{"name":"Tata Digital India","isin":"INF277K01AT3","weight":20,"type":"equity"},{"name":"Aditya Birla Digital India","isin":"INF084M01BC5","weight":15,"type":"equity"},{"name":"Franklin India Technology","isin":"INF090I01023","weight":15,"type":"equity"},{"name":"SBI Technology Opp Fund","isin":"INF200K01MH3","weight":20,"type":"equity"},{"name":"Liquid Fund","isin":"INF200K01FT1","weight":10,"type":"liquid"}]'
        ),
        ('senior-citizen-income', 'Senior Citizen Income Portfolio', 'Monthly income with capital safety for retirees 60+', 'conservative', 'debt',
          '["regular_income","capital_preservation","retirement"]', 5000, '3-5 years', 'CRISIL Short Term Bond Index', TO_CHAR(NOW() - INTERVAL '5 days', 'YYYY-MM-DD'), 'monthly', 8, 'Monthly SWP to bank account — designed for retirees', '🧓', TRUE,
          '[{"type":"scss_equiv","label":"Senior Savings Equiv","weight":30},{"type":"corporate_bond","label":"AAA Bonds","weight":35},{"type":"balanced","label":"Conservative Hybrid","weight":20},{"type":"gold","label":"Gold Hedge","weight":15}]',
          '[{"name":"HDFC Short Term Debt","isin":"INF179K01XB6","weight":20,"type":"debt"},{"name":"ICICI Pru Corporate Bond","isin":"INF109K01XS7","weight":25,"type":"debt"},{"name":"Kotak Bond Short Term","isin":"INF174K01VB9","weight":15,"type":"debt"},{"name":"SBI Conservative Hybrid","isin":"INF200K01RD1","weight":15,"type":"hybrid"},{"name":"HDFC Balanced Advantage","isin":"INF179K01WE0","weight":10,"type":"hybrid"},{"name":"Nippon Gold ETF","isin":"INF204KA1I34","weight":15,"type":"gold"}]'
        ),
        ('esg-sustainable', 'ESG & Sustainable Portfolio', 'Invest in businesses with strong ESG practices', 'moderate', 'equity',
          '["esg","socially_responsible","wealth_creation"]', 10000, '5+ years', 'Nifty 100 ESG Index', TO_CHAR(NOW() - INTERVAL '4 days', 'YYYY-MM-DD'), 'semi_annual', 8, 'SEBI ESG-screened funds for responsible investors', '🌱', FALSE,
          '[{"type":"esg_large","label":"ESG Large Cap","weight":50},{"type":"esg_multi","label":"ESG Multi Cap","weight":30},{"type":"green_debt","label":"Green Bonds","weight":20}]',
          '[{"name":"Mirae Asset ESG Sector Leaders","isin":"INF769K01EZ5","weight":25,"type":"equity"},{"name":"Aditya Birla ESG Fund","isin":"INF084M01GI7","weight":20,"type":"equity"},{"name":"SBI Magnum Equity ESG","isin":"INF200K01TY4","weight":20,"type":"equity"},{"name":"Kotak ESG Opportunities","isin":"INF174K01ZX3","weight":15,"type":"equity"},{"name":"HDFC Corp Bond","isin":"INF179K01WD2","weight":20,"type":"debt"}]'
        ),


        ('india-infrastructure', 'India Infrastructure Portfolio', 'Capitalise on India''s ₹111 lakh crore infra investment', 'aggressive', 'thematic',
          '["capital_appreciation","thematic","infrastructure"]', 15000, '7+ years', 'Nifty Infrastructure Index', TO_CHAR(NOW() - INTERVAL '6 days', 'YYYY-MM-DD'), 'quarterly', 9, 'Roads, ports, power, railways — India building spree', '🏗️', FALSE,
          '[{"type":"infra_equity","label":"Infrastructure Equity","weight":60},{"type":"roads_power","label":"Roads & Power","weight":25},{"type":"invit","label":"InvITs","weight":15}]',
          '[{"name":"ICICI Pru Infrastructure","isin":"INF109K01DC0","weight":25,"type":"equity"},{"name":"Kotak Infrastructure & Economic Reform","isin":"INF174K01HE6","weight":20,"type":"equity"},{"name":"DSP India T.I.G.E.R Fund","isin":"INF740K01137","weight":15,"type":"equity"},{"name":"Tata Infrastructure Fund","isin":"INF277K01DP4","weight":15,"type":"equity"},{"name":"IRB InvIT","isin":"INE500L20022","weight":10,"type":"invit"},{"name":"IndiGrid InvIT","isin":"INE219O01021","weight":15,"type":"invit"}]'
        ),
        ('healthcare-pharma', 'Healthcare & Pharma Portfolio', 'Defensive sector with structural long-term growth', 'moderate', 'thematic',
          '["capital_appreciation","thematic","defensive"]', 10000, '5+ years', 'Nifty Pharma Index', TO_CHAR(NOW() - INTERVAL '7 days', 'YYYY-MM-DD'), 'semi_annual', 8, 'India''s $130B pharma & healthcare opportunity', '🏥', FALSE,
          '[{"type":"pharma","label":"Pharma & Biotech","weight":50},{"type":"hospitals","label":"Hospitals & Diagnostics","weight":30},{"type":"medtech","label":"MedTech","weight":20}]',
          '[{"name":"ICICI Pru Pharma Healthcare","isin":"INF109K01XP3","weight":25,"type":"equity"},{"name":"Mirae Asset Healthcare","isin":"INF769K01EX0","weight":20,"type":"equity"},{"name":"UTI Healthcare Fund","isin":"INF789F01GV4","weight":20,"type":"equity"},{"name":"Nippon India Pharma","isin":"INF204K01BI5","weight":20,"type":"equity"},{"name":"DSP Healthcare Fund","isin":"INF740K01GJ4","weight":15,"type":"equity"}]'
        ),
        ('multi-asset-5factor', 'Multi-Asset 5-Factor Portfolio', 'True diversification across 5 uncorrelated asset classes', 'moderate', 'hybrid',
          '["diversification","steady_growth","downside_protection"]', 20000, '5+ years', 'CRISIL Multi Asset Index', TO_CHAR(NOW() - INTERVAL '8 days', 'YYYY-MM-DD'), 'quarterly', 10, 'Equity + Debt + Gold + REIT + International — all in one', '🌐', TRUE,
          '[{"type":"equity","label":"Indian Equity","weight":35},{"type":"international","label":"International","weight":15},{"type":"debt","label":"Debt","weight":25},{"type":"gold","label":"Gold","weight":15},{"type":"reit","label":"REIT/InvIT","weight":10}]',
          '[{"name":"Nifty 500 Index Fund","isin":"INF204KA1B73","weight":20,"type":"equity"},{"name":"Parag Parikh Flexi Cap","isin":"INF879O01027","weight":15,"type":"equity"},{"name":"ICICI Pru US Bluechip","isin":"INF109KA1YC2","weight":15,"type":"international"},{"name":"HDFC Short Term Debt","isin":"INF179K01XB6","weight":15,"type":"debt"},{"name":"Gilt Fund","isin":"INF174KA1JI7","weight":10,"type":"debt"},{"name":"Nippon Gold ETF","isin":"INF204KA1I34","weight":15,"type":"gold"},{"name":"Embassy REIT","isin":"INE251K01021","weight":10,"type":"reit"}]'
        ),
        ('first-time-investor', 'First-Time Investor Starter', 'Simple 2-fund portfolio for India''s new investors', 'moderate', 'equity',
          '["wealth_creation","long_term_wealth","beginner"]', 500, '5+ years', 'Nifty 500', TO_CHAR(NOW() - INTERVAL '1 days', 'YYYY-MM-DD'), 'annual', 3, 'Start with ₹500/month — simplest path to wealth', '🌟', TRUE,
          '[{"type":"index_equity","label":"Equity Index","weight":70},{"type":"debt","label":"Debt Safety","weight":30}]',
          '[{"name":"UTI Nifty 50 Index Fund","isin":"INF789FC1G50","weight":50,"type":"equity"},{"name":"Nifty Next 50 Index Fund","isin":"INF247L01032","weight":20,"type":"equity"},{"name":"HDFC Short Term Debt","isin":"INF179K01XB6","weight":30,"type":"debt"}]'
        ),
        ('home-purchase', 'Home Purchase Portfolio', 'Build your down payment in 3-5 years', 'conservative', 'goal_based',
          '["home_purchase","goal_planning","capital_preservation"]', 5000, '3-5 years', 'CRISIL Hybrid 25+75 Conservative Index', TO_CHAR(NOW() - INTERVAL '2 days', 'YYYY-MM-DD'), 'quarterly', 6, 'Targeted corpus build for home down payment', '🏠', FALSE,
          '[{"type":"equity","label":"Equity Growth","weight":30},{"type":"hybrid","label":"Hybrid Buffer","weight":20},{"type":"debt","label":"Debt Safety","weight":50}]',
          '[{"name":"Parag Parikh Flexi Cap","isin":"INF879O01027","weight":15,"type":"equity"},{"name":"Nifty 50 Index","isin":"INF204KA1B73","weight":15,"type":"equity"},{"name":"HDFC Balanced Advantage","isin":"INF179K01WE0","weight":20,"type":"hybrid"},{"name":"HDFC Short Term Debt","isin":"INF179K01XB6","weight":25,"type":"debt"},{"name":"SBI Corp Bond","isin":"INF200K01RH2","weight":25,"type":"debt"}]'
        ),


        ('banking-bfsi', 'Banking & BFSI Portfolio', 'India''s financial sector — largest Nifty weight play', 'aggressive', 'thematic',
          '["capital_appreciation","thematic","financial_sector"]', 15000, '5+ years', 'Nifty Bank Index', TO_CHAR(NOW() - INTERVAL '5 days', 'YYYY-MM-DD'), 'quarterly', 8, 'Banks, NBFCs, insurance — India credit growth story', '🏦', FALSE,
          '[{"type":"banks","label":"Banks","weight":60},{"type":"nbfc","label":"NBFC & Insurance","weight":30},{"type":"liquid","label":"Liquid","weight":10}]',
          '[{"name":"ICICI Pru Banking & Financial Services","isin":"INF109K01XF0","weight":25,"type":"equity"},{"name":"SBI Banking & Financial Services","isin":"INF200K01LM5","weight":20,"type":"equity"},{"name":"Nippon India Banking","isin":"INF204K01XI9","weight":20,"type":"equity"},{"name":"HDFC Banking ETF","isin":"INF179K01XJ9","weight":25,"type":"equity"},{"name":"Liquid Fund","isin":"INF200K01FT1","weight":10,"type":"liquid"}]'
        ),
        ('consumption-rural', 'Consumption & Rural India', 'India''s 900M rural consumers driving next growth wave', 'moderate', 'thematic',
          '["capital_appreciation","thematic","consumption"]', 10000, '5+ years', 'Nifty India Consumption', TO_CHAR(NOW() - INTERVAL '3 days', 'YYYY-MM-DD'), 'quarterly', 9, 'FMCG, retail, agri-inputs — rural India rising', '🛒', FALSE,
          '[{"type":"fmcg","label":"FMCG & Consumer","weight":50},{"type":"agri","label":"Agri & Rural","weight":25},{"type":"retail","label":"Retail & D2C","weight":25}]',
          '[{"name":"Mirae Asset Great Consumer","isin":"INF769K01EW2","weight":25,"type":"equity"},{"name":"ICICI Pru FMCG Fund","isin":"INF109K01GE4","weight":20,"type":"equity"},{"name":"SBI Consumption Opportunities","isin":"INF200K01TZ1","weight":20,"type":"equity"},{"name":"Canara Robeco Consumer Trends","isin":"INF760K01DM7","weight":20,"type":"equity"},{"name":"Kotak India EQ Contra","isin":"INF174K01HQ0","weight":15,"type":"equity"}]'
        ),
        ('manufacturing-make-in-india', 'Manufacturing & Make in India', 'PLI schemes + China+1 driving India''s factory boom', 'aggressive', 'thematic',
          '["capital_appreciation","thematic","manufacturing"]', 15000, '7+ years', 'Nifty India Manufacturing', TO_CHAR(NOW() - INTERVAL '4 days', 'YYYY-MM-DD'), 'quarterly', 9, 'Chemicals, auto, electronics, defence manufacturing', '🏭', FALSE,
          '[{"type":"auto","label":"Auto & Auto Anc","weight":30},{"type":"chemicals","label":"Chemicals & Specialty","weight":25},{"type":"defence","label":"Defence & Aero","weight":25},{"type":"electronics","label":"Electronics Mfg","weight":20}]',
          '[{"name":"DSP India T.I.G.E.R Fund","isin":"INF740K01137","weight":20,"type":"equity"},{"name":"ICICI Pru Manufacturing","isin":"INF109K01XN8","weight":20,"type":"equity"},{"name":"Aditya Birla Manufacturing Equity","isin":"INF084M01GJ5","weight":20,"type":"equity"},{"name":"HDFC Manufacturing Fund","isin":"INF179K01YD3","weight":20,"type":"equity"},{"name":"Kotak Manufacture in India","isin":"INF174KA1SB9","weight":20,"type":"equity"}]'
        ),
        ('hni-wealth-compounder', 'HNI Wealth Compounder', 'PMS-like quality investing for high-net-worth individuals', 'moderate', 'equity',
          '["capital_appreciation","wealth_creation","quality_factor"]', 500000, '7+ years', 'Nifty 200 Quality 30', TO_CHAR(NOW() - INTERVAL '6 days', 'YYYY-MM-DD'), 'quarterly', 12, 'Concentrated high-conviction quality portfolio for HNIs', '👑', FALSE,
          '[{"type":"quality_large","label":"Quality Large Cap","weight":50},{"type":"quality_mid","label":"Quality Mid Cap","weight":30},{"type":"alternatives","label":"Alternatives","weight":20}]',
          '[{"name":"Axis Growth Opportunities","isin":"INF846K01EX0","weight":20,"type":"equity"},{"name":"Mirae Asset Focused","isin":"INF769K01EY8","weight":20,"type":"equity"},{"name":"PPFAS Flexi Cap","isin":"INF879O01027","weight":15,"type":"equity"},{"name":"Kotak Focused Equity","isin":"INF174KA1RX9","weight":15,"type":"equity"},{"name":"Embassy REIT","isin":"INE251K01021","weight":10,"type":"reit"},{"name":"IndiGrid InvIT","isin":"INE219O01021","weight":10,"type":"invit"},{"name":"Nippon Gold ETF","isin":"INF204KA1I34","weight":10,"type":"gold"}]'
        ),
        ('intl-emerging-markets', 'International Emerging Markets', 'China, SE Asia & Brazil beyond US equity exposure', 'aggressive', 'international',
          '["global_diversification","emerging_market_growth","currency_hedge"]', 10000, '7+ years', 'MSCI Emerging Markets Index', TO_CHAR(NOW() - INTERVAL '7 days', 'YYYY-MM-DD'), 'semi_annual', 7, 'Emerging market alpha beyond India for global investors', '🗺️', FALSE,
          '[{"type":"china","label":"China & HK","weight":35},{"type":"sea","label":"SE Asia","weight":25},{"type":"latam","label":"Brazil & LatAm","weight":20},{"type":"other_em","label":"Other EM","weight":20}]',
          '[{"name":"Edelweiss Greater China Equity","isin":"INF754K01HK2","weight":25,"type":"international"},{"name":"Mirae Asset NYSE FANG+ ETF FoF","isin":"INF769K01FE9","weight":15,"type":"international"},{"name":"Franklin Asian Equity","isin":"INF090I01155","weight":20,"type":"international"},{"name":"DSP World Mining","isin":"INF740K01EB5","weight":20,"type":"international"},{"name":"Kotak International REIT FoF","isin":"INF174KA1RW1","weight":20,"type":"international"}]'
        ),
        ('arbitrage-liquid-hybrid', 'Arbitrage & Liquid Hybrid', 'Tax-efficient liquid parking — equity taxation on liquid returns', 'conservative', 'hybrid',
          '["capital_preservation","tax_efficiency","liquidity"]', 25000, '3-12 months', 'Nifty 50 Arbitrage Index', TO_CHAR(NOW() - INTERVAL '2 days', 'YYYY-MM-DD'), 'quarterly', 6, 'Liquid fund alternative with lower tax for 3M+ horizon', '🔄', FALSE,
          '[{"type":"arbitrage","label":"Arbitrage","weight":65},{"type":"liquid","label":"Liquid","weight":20},{"type":"ultra_short","label":"Ultra Short Debt","weight":15}]',
          '[{"name":"ICICI Pru Arbitrage Fund","isin":"INF109K01XG8","weight":25,"type":"hybrid"},{"name":"Kotak Arbitrage Fund","isin":"INF174K01ZI5","weight":20,"type":"hybrid"},{"name":"SBI Arbitrage Opportunities","isin":"INF200K01LL7","weight":20,"type":"hybrid"},{"name":"HDFC Arbitrage Fund","isin":"INF179K01WL2","weight":20,"type":"hybrid"},{"name":"SBI Liquid Fund","isin":"INF200K01FT1","weight":15,"type":"liquid"}]'
        ),
        ('wedding-milestone', 'Wedding & Milestone Portfolio', 'Build your big-day corpus in 2-4 years', 'conservative', 'goal_based',
          '["goal_planning","wedding","milestone"]', 2000, '2-4 years', 'CRISIL Hybrid 25+75 Conservative Index', TO_CHAR(NOW() - INTERVAL '1 days', 'YYYY-MM-DD'), 'quarterly', 5, 'Capital-safe milestone planning with moderate growth', '💍', FALSE,
          '[{"type":"hybrid","label":"Conservative Hybrid","weight":40},{"type":"debt","label":"Short Debt","weight":40},{"type":"gold","label":"Gold Auspice","weight":20}]',
          '[{"name":"HDFC Balanced Advantage","isin":"INF179K01WE0","weight":25,"type":"hybrid"},{"name":"SBI Conservative Hybrid","isin":"INF200K01RD1","weight":15,"type":"hybrid"},{"name":"HDFC Short Term Debt","isin":"INF179K01XB6","weight":25,"type":"debt"},{"name":"Kotak Bond Short Term","isin":"INF174K01VB9","weight":15,"type":"debt"},{"name":"Nippon Gold ETF","isin":"INF204KA1I34","weight":20,"type":"gold"}]'
        ),
        ('emergency-fund', 'Emergency Fund Portfolio', 'Instant-access 6-month expense cushion', 'conservative', 'debt',
          '["capital_preservation","liquidity","emergency"]', 1000, '0-3 months', 'CRISIL Liquid Fund Index', TO_CHAR(NOW() - INTERVAL '1 days', 'YYYY-MM-DD'), 'monthly', 3, 'Same-day redemption — your financial safety net', '🛡️', FALSE,
          '[{"type":"overnight","label":"Overnight","weight":30},{"type":"liquid","label":"Liquid","weight":50},{"type":"ultra_short","label":"Ultra Short","weight":20}]',
          '[{"name":"Nippon Overnight Fund","isin":"INF204KA1T97","weight":30,"type":"liquid"},{"name":"HDFC Liquid Fund","isin":"INF179K01WF7","weight":30,"type":"liquid"},{"name":"SBI Liquid Fund","isin":"INF200K01FT1","weight":20,"type":"liquid"},{"name":"ICICI Pru Ultra Short Term","isin":"INF109K01YS3","weight":20,"type":"debt"}]'
        ),
        ('family-office', 'Family Office Portfolio', 'Institutional-grade multi-asset wealth for UHNIs & family offices', 'moderate', 'hybrid',
          '["wealth_preservation","capital_appreciation","global_diversification","estate_planning","alternative_investments"]', 10000000, '10+ years', 'CRISIL Multi Asset 60:40 Index', TO_CHAR(NOW() - INTERVAL '3 days', 'YYYY-MM-DD'), 'quarterly', 15, 'Institutional-grade 6-asset-class architecture for multi-generational wealth', '🏛️', TRUE,
          '[{"type":"quality_equity","label":"Quality Indian Equity","weight":25},{"type":"international","label":"International Equity","weight":15},{"type":"alternatives","label":"AIF / Private Equity","weight":15},{"type":"reit_invit","label":"REIT & InvIT","weight":15},{"type":"debt","label":"Debt & Fixed Income","weight":20},{"type":"gold","label":"Gold & SGBs","weight":10}]',
          '[{"name":"Parag Parikh Flexi Cap Fund","isin":"INF879O01027","weight":12,"type":"equity"},{"name":"Mirae Asset Large Cap Fund","isin":"INF769K01010","weight":8,"type":"equity"},{"name":"Nifty 50 Index Fund","isin":"INF204KA1B73","weight":5,"type":"equity"},{"name":"ICICI Pru US Bluechip","isin":"INF109KA1YC2","weight":8,"type":"international"},{"name":"Motilal Oswal Nasdaq 100","isin":"INF247L01024","weight":7,"type":"international"},{"name":"Embassy Office Parks REIT","isin":"INE251K01021","weight":8,"type":"reit"},{"name":"Mindspace Business Parks REIT","isin":"INE037FC01012","weight":7,"type":"reit"},{"name":"ICICI Pru Corporate Bond","isin":"INF109K01XS7","weight":10,"type":"debt"},{"name":"BHARAT Bond ETF Apr 2032","isin":"INF464K01000","weight":10,"type":"debt"},{"name":"Nippon India ETF Gold BeES","isin":"INF204KB12A6","weight":6,"type":"gold"},{"name":"Sovereign Gold Bond 2026-27","isin":"IN0020240135","weight":4,"type":"gold"},{"name":"SBI Liquid Fund","isin":"INF200K01FT1","weight":5,"type":"liquid"}]'
        )
      ON CONFLICT (id) DO NOTHING;
    `);
		console.log("✅ model_portfolios table created and seeded (engine audit Fix #6)");
	} catch (mpErr: any) {
		console.warn("[Migration] model_portfolios setup skipped (non-fatal):", mpErr?.message);
	}

	// ── SCREENER MONEYCONTROL-PARITY UPGRADE ──────────────────────────────────
	// Adds columns for: returns (1W/1M/3M/6M/1Y/2Y/3Y/5Y/YTD), risk metrics,
	// Piotroski F-Score, Altman Z-Score, Technical Rating, ROCE, all 4 pivot
	// methods, shareholding table, and 52-week H/L data.
	// Safe: all ADD COLUMN IF NOT EXISTS — idempotent, zero data loss.
	try {
		const { db: migDb } = await import("../db");
		const { sql: migSql } = await import("drizzle-orm");

		// 1. Create screener_shareholding table (quarterly promoter/FII/DII data)
		await migDb.execute(migSql`
      CREATE TABLE IF NOT EXISTS screener_shareholding (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) NOT NULL,
        quarter_date DATE NOT NULL,
        quarter_label VARCHAR(20),
        promoter_holding DECIMAL(8,4),
        fii_holding DECIMAL(8,4),
        dii_holding DECIMAL(8,4),
        mutual_fund_holding DECIMAL(8,4),
        public_holding DECIMAL(8,4),
        other_holding DECIMAL(8,4),
        promoter_holding_change DECIMAL(8,4),
        fii_holding_change DECIMAL(8,4),
        dii_holding_change DECIMAL(8,4),
        mutual_fund_holding_change DECIMAL(8,4),
        public_holding_change DECIMAL(8,4),
        pledged_shares DECIMAL(8,4),
        pledged_shares_change DECIMAL(8,4),
        total_shares BIGINT,
        promoter_shares BIGINT,
        fii_shares BIGINT,
        dii_shares BIGINT,
        data_source VARCHAR(10) DEFAULT 'bse',
        fetched_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(symbol, quarter_date)
      );
    `);
		console.log("✅ screener_shareholding table ready");

		// 1b. Deduplicate screener_price_history before creating unique index
		//     (partial fire-and-forget loads may have inserted duplicate symbol+date rows)
		await migDb.execute(migSql`
      DELETE FROM screener_price_history a
      USING screener_price_history b
      WHERE a.id < b.id
        AND a.symbol = b.symbol
        AND a.date = b.date
    `);
		console.log("✅ screener_price_history duplicates removed");

		// 1c. Ensure unique index on screener_price_history(symbol, date)
		//     Required for ON CONFLICT (symbol, date) DO NOTHING in price history ingestion
		await migDb.execute(migSql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_screener_price_history_symbol_date
      ON screener_price_history(symbol, date)
    `);
		console.log("✅ screener_price_history unique index on (symbol, date) ensured");

		// 2. Extend screener_derived_metrics with return series + risk + quality
		await migDb.execute(migSql`
      ALTER TABLE screener_derived_metrics
        ADD COLUMN IF NOT EXISTS return_1w DECIMAL(10,6),
        ADD COLUMN IF NOT EXISTS return_1m DECIMAL(10,6),
        ADD COLUMN IF NOT EXISTS return_3m DECIMAL(10,6),
        ADD COLUMN IF NOT EXISTS return_6m DECIMAL(10,6),
        ADD COLUMN IF NOT EXISTS return_1y DECIMAL(10,6),
        ADD COLUMN IF NOT EXISTS return_2y DECIMAL(10,6),
        ADD COLUMN IF NOT EXISTS return_3y DECIMAL(10,6),
        ADD COLUMN IF NOT EXISTS return_5y DECIMAL(10,6),
        ADD COLUMN IF NOT EXISTS return_ytd DECIMAL(10,6),
        ADD COLUMN IF NOT EXISTS return_vs_nifty_1y DECIMAL(10,6),
        ADD COLUMN IF NOT EXISTS return_vs_sector_1y DECIMAL(10,6),
        ADD COLUMN IF NOT EXISTS beta DECIMAL(8,4),
        ADD COLUMN IF NOT EXISTS sharpe_ratio_1y DECIMAL(8,4),
        ADD COLUMN IF NOT EXISTS sortino_ratio_1y DECIMAL(8,4),
        ADD COLUMN IF NOT EXISTS max_drawdown_1y DECIMAL(8,4),
        ADD COLUMN IF NOT EXISTS volatility_30d DECIMAL(8,4),
        ADD COLUMN IF NOT EXISTS piotroski_score SMALLINT,
        ADD COLUMN IF NOT EXISTS piotroski_details JSONB,
        ADD COLUMN IF NOT EXISTS altman_z_score DECIMAL(10,4),
        ADD COLUMN IF NOT EXISTS dividend_per_share DECIMAL(10,4),
        ADD COLUMN IF NOT EXISTS face_value DECIMAL(10,4),
        ADD COLUMN IF NOT EXISTS week_high_52 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS week_low_52 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS technical_rating VARCHAR(20),
        ADD COLUMN IF NOT EXISTS last_calculated TIMESTAMPTZ DEFAULT NOW();
    `);
		console.log("✅ screener_derived_metrics extended with returns + risk + quality");

		// Ensure unique constraint exists on symbol (required for ON CONFLICT ... DO NOTHING)
		await migDb.execute(migSql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_screener_derived_symbol_uq
      ON screener_derived_metrics(symbol)
    `);
		console.log("✅ screener_derived_metrics unique index on symbol ensured");

		// 3. Extend screener_technical_indicators with new indicators + pivots
		await migDb.execute(migSql`
      ALTER TABLE screener_technical_indicators
        ADD COLUMN IF NOT EXISTS high DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS low DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS open DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS volume BIGINT,
        ADD COLUMN IF NOT EXISTS cci_20 DECIMAL(10,4),
        ADD COLUMN IF NOT EXISTS stoch_k DECIMAL(8,4),
        ADD COLUMN IF NOT EXISTS stoch_d DECIMAL(8,4),
        ADD COLUMN IF NOT EXISTS williams_r DECIMAL(8,4),
        ADD COLUMN IF NOT EXISTS mfi_14 DECIMAL(8,4),
        ADD COLUMN IF NOT EXISTS atr_14 DECIMAL(10,4),
        ADD COLUMN IF NOT EXISTS bb_upper DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS bb_middle DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS bb_lower DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS bb_bandwidth DECIMAL(8,4),
        ADD COLUMN IF NOT EXISTS bb_pct_b DECIMAL(8,4),
        ADD COLUMN IF NOT EXISTS supertrend DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS supertrend_signal VARCHAR(10),
        ADD COLUMN IF NOT EXISTS obv BIGINT,
        ADD COLUMN IF NOT EXISTS vwap DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS week_high_52 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS week_low_52 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pct_from_52w_high DECIMAL(8,4),
        ADD COLUMN IF NOT EXISTS pct_from_52w_low DECIMAL(8,4),
        ADD COLUMN IF NOT EXISTS technical_rating VARCHAR(20),
        ADD COLUMN IF NOT EXISTS bullish_signals SMALLINT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS bearish_signals SMALLINT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS neutral_signals SMALLINT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS pivot_classic_p DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_classic_r1 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_classic_r2 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_classic_r3 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_classic_s1 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_classic_s2 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_classic_s3 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_fib_r1 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_fib_r2 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_fib_r3 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_fib_s1 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_fib_s2 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_fib_s3 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_cam_r1 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_cam_r2 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_cam_r3 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_cam_r4 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_cam_s1 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_cam_s2 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_cam_s3 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_cam_s4 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_woodie_p DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_woodie_r1 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_woodie_r2 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_woodie_s1 DECIMAL(12,4),
        ADD COLUMN IF NOT EXISTS pivot_woodie_s2 DECIMAL(12,4);
    `);
		console.log("✅ screener_technical_indicators extended with indicators + all pivot methods");

		// 4. Add ROCE to screener_financials if missing
		await migDb.execute(migSql`
      ALTER TABLE screener_financials
        ADD COLUMN IF NOT EXISTS roce DECIMAL(10,4),
        ADD COLUMN IF NOT EXISTS current_ratio DECIMAL(8,4),
        ADD COLUMN IF NOT EXISTS quick_ratio DECIMAL(8,4),
        ADD COLUMN IF NOT EXISTS interest_coverage DECIMAL(8,4);
    `);
		console.log("✅ screener_financials extended with ROCE, ratios");

		// 5. Ensure screener_stocks has is_active column (may be missing in older DB setups)
		await migDb.execute(migSql`
      ALTER TABLE screener_stocks
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
    `);
		// Backfill: set all existing rows to active if newly added
		await migDb.execute(migSql`
      UPDATE screener_stocks SET is_active = TRUE WHERE is_active IS NULL
    `);
		console.log("✅ screener_stocks.is_active ensured");

		console.log("✅ [Screener MoneyControl-parity] All migrations complete");
    // ── model_portfolios — Quant Alpha Engine columns (FASP-AI-v2.0) ──────────
    try {
      await migDb.execute(migSql`
        ALTER TABLE model_portfolios
          ADD COLUMN IF NOT EXISTS drift_score          INTEGER         DEFAULT 0,
          ADD COLUMN IF NOT EXISTS drift_details        JSONB           DEFAULT '[]',
          ADD COLUMN IF NOT EXISTS quant_engine_version VARCHAR(50)     DEFAULT 'FASP-AI-v2.0',
          ADD COLUMN IF NOT EXISTS last_quant_run       TIMESTAMP
      `);
      await migDb.execute(migSql`
        CREATE INDEX IF NOT EXISTS idx_model_portfolios_drift ON model_portfolios (drift_score DESC)
      `);
      console.log("  ✅ model_portfolios: quant alpha columns (drift_score, drift_details, last_quant_run)");
    } catch (e: any) {
      console.warn("  ⚠️  model_portfolios quant columns migration (non-fatal):", e.message?.slice(0, 80));
    }

    } catch (screenerMigErr: any) {
		console.warn("[Migration] Screener parity migration skipped (non-fatal):", screenerMigErr?.message);
	}

	// ── Phase 1: Screener unique constraints (data integrity) ─────────────────
	// Safe on existing data: CREATE UNIQUE INDEX CONCURRENTLY does not lock.
	// If duplicates exist the constraint creation will fail gracefully (non-fatal).
	// Phase 1-3 use db + sql re-imported at function scope (inner catch closed prev scope).
	const { db: p1Db } = await import("../db");
	const { sql: p1Sql } = await import("drizzle-orm");
	try {
		await p1Db.execute(p1Sql`ALTER TABLE screener_financials DROP CONSTRAINT IF EXISTS uq_screener_fin_symbol_period`);
		await p1Db.execute(p1Sql`
			CREATE UNIQUE INDEX IF NOT EXISTS uq_screener_fin_symbol_period
			ON screener_financials (symbol, period)
		`);
		console.log("  ✅ screener_financials: unique(symbol, period)");
	} catch (e: any) {
		console.warn("  ⚠️  screener_financials unique constraint (non-fatal):", e.message?.slice(0, 120));
	}
	try {
		await p1Db.execute(p1Sql`
			CREATE UNIQUE INDEX IF NOT EXISTS uq_screener_price_hist
			ON screener_price_history (symbol, date)
		`);
		console.log("  ✅ screener_price_history: unique(symbol, date)");
	} catch (e: any) {
		console.warn("  ⚠️  screener_price_history unique constraint (non-fatal):", e.message?.slice(0, 120));
	}
	try {
		await p1Db.execute(p1Sql`
			CREATE UNIQUE INDEX IF NOT EXISTS uq_screener_growth
			ON screener_growth_metrics (symbol, date, period)
		`);
		console.log("  ✅ screener_growth_metrics: unique(symbol, date, period)");
	} catch (e: any) {
		console.warn("  ⚠️  screener_growth_metrics unique constraint (non-fatal):", e.message?.slice(0, 120));
	}
	try {
		await p1Db.execute(p1Sql`
			CREATE UNIQUE INDEX IF NOT EXISTS uq_screener_km
			ON screener_key_metrics (symbol, date, period)
		`);
		console.log("  ✅ screener_key_metrics: unique(symbol, date, period)");
	} catch (e: any) {
		console.warn("  ⚠️  screener_key_metrics unique constraint (non-fatal):", e.message?.slice(0, 120));
	}
	try {
		await p1Db.execute(p1Sql`
			CREATE UNIQUE INDEX IF NOT EXISTS uq_screener_dcf
			ON screener_dcf_valuations (symbol, date)
		`);
		console.log("  ✅ screener_dcf_valuations: unique(symbol, date)");
	} catch (e: any) {
		console.warn("  ⚠️  screener_dcf_valuations unique constraint (non-fatal):", e.message?.slice(0, 120));
	}
	try {
		await p1Db.execute(p1Sql`
			CREATE UNIQUE INDEX IF NOT EXISTS uq_sector_perf
			ON screener_sector_performance (sector, date)
		`);
		console.log("  ✅ screener_sector_performance: unique(sector, date)");
	} catch (e: any) {
		console.warn("  ⚠️  screener_sector_performance unique constraint (non-fatal):", e.message?.slice(0, 120));
	}

	// ── Phase 1: Per-table freshness columns in screener_stocks ───────────────
	try {
		await p1Db.execute(p1Sql`
			ALTER TABLE screener_stocks
			  ADD COLUMN IF NOT EXISTS last_financials_sync  TIMESTAMP,
			  ADD COLUMN IF NOT EXISTS last_technicals_sync  TIMESTAMP,
			  ADD COLUMN IF NOT EXISTS last_shareholding_sync TIMESTAMP,
			  ADD COLUMN IF NOT EXISTS last_key_metrics_sync  TIMESTAMP
		`);
		console.log("  ✅ screener_stocks: per-table freshness columns added");
	} catch (e: any) {
		console.warn("  ⚠️  screener_stocks freshness columns (non-fatal):", e.message?.slice(0, 120));
	}

	// ── Phase 2c: DCF upside_percent column ───────────────────────────────────
	try {
		await p1Db.execute(p1Sql`
			ALTER TABLE screener_dcf_valuations
			  ADD COLUMN IF NOT EXISTS upside_percent DECIMAL(8,2)
		`);
		console.log("  ✅ screener_dcf_valuations: upside_percent column added");
	} catch (e: any) {
		console.warn("  ⚠️  screener_dcf_valuations upside_percent (non-fatal):", e.message?.slice(0, 120));
	}

	// ── Phase 2d: screener_analyst_consensus materialized table ───────────────
	try {
		await p1Db.execute(p1Sql`
			CREATE TABLE IF NOT EXISTS screener_analyst_consensus (
				symbol            VARCHAR   PRIMARY KEY,
				avg_target        DECIMAL(15,2),
				high_target       DECIMAL(15,2),
				low_target        DECIMAL(15,2),
				analyst_count     INTEGER DEFAULT 0,
				buy_count         INTEGER DEFAULT 0,
				hold_count        INTEGER DEFAULT 0,
				sell_count        INTEGER DEFAULT 0,
				consensus_rating  VARCHAR,
				upside_pct        DECIMAL(8,2),
				last_updated      TIMESTAMP DEFAULT NOW()
			)
		`);
		await p1Db.execute(p1Sql`CREATE INDEX IF NOT EXISTS idx_analyst_consensus_upside ON screener_analyst_consensus (upside_pct)`);
		await p1Db.execute(p1Sql`CREATE INDEX IF NOT EXISTS idx_analyst_consensus_rating ON screener_analyst_consensus (consensus_rating)`);
		console.log("  ✅ screener_analyst_consensus: created");
	} catch (e: any) {
		console.warn("  ⚠️  screener_analyst_consensus (non-fatal):", e.message?.slice(0, 120));
	}

	// ── Phase 3a: Composite performance indexes ────────────────────────────────
	try {
		await p1Db.execute(p1Sql`CREATE INDEX IF NOT EXISTS idx_fin_pe_symbol ON screener_financials (symbol, pe_ratio)`);
		await p1Db.execute(p1Sql`CREATE INDEX IF NOT EXISTS idx_fin_roe_symbol ON screener_financials (symbol, roe)`);
		await p1Db.execute(p1Sql`CREATE INDEX IF NOT EXISTS idx_derived_score_rating ON screener_derived_metrics (composite_score, fintek_rating)`);
		await p1Db.execute(p1Sql`CREATE INDEX IF NOT EXISTS idx_derived_return1y_score ON screener_derived_metrics (return_1y, composite_score)`);
		await p1Db.execute(p1Sql`CREATE INDEX IF NOT EXISTS idx_derived_return_beta ON screener_derived_metrics (return_1y, beta)`);        // Phase 3a remaining
		await p1Db.execute(p1Sql`CREATE INDEX IF NOT EXISTS idx_derived_alpha_nifty ON screener_derived_metrics (return_vs_nifty_1y)`);     // Phase 3a remaining
		await p1Db.execute(p1Sql`CREATE INDEX IF NOT EXISTS idx_screener_dcf_upside ON screener_dcf_valuations (upside_percent)`);
		console.log("  ✅ screener: composite performance indexes added");
	} catch (e: any) {
		console.warn("  ⚠️  screener composite indexes (non-fatal):", e.message?.slice(0, 120));
	}

	console.log("✅ [Phase 1-3] Screener DB integrity + performance upgrades complete");

	// ── Phase 5: Date type migration + hot-cold split ────────────────────────
	// 5a: screener_price_history.date varchar → date (safe: all rows are YYYY-MM-DD)
	try {
		await p1Db.execute(p1Sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'screener_price_history'
            AND column_name = 'date'
            AND data_type = 'character varying'
        ) THEN
          -- Drop the unique index first (can't change column type with index on it)
          DROP INDEX IF EXISTS uq_screener_price_hist;
          -- Recast in-place — all values are YYYY-MM-DD strings so cast is lossless
          ALTER TABLE screener_price_history
            ALTER COLUMN date TYPE date USING date::date;
          -- Recreate the unique index on the new date type
          CREATE UNIQUE INDEX IF NOT EXISTS uq_screener_price_hist
            ON screener_price_history (symbol, date);
          RAISE NOTICE 'screener_price_history.date migrated varchar → date';
        END IF;
      END $$
    `);
		console.log("  ✅ Phase 5a: screener_price_history.date → date type");
	} catch (e: any) {
		console.warn("  ⚠️  Phase 5a date migration (non-fatal):", e.message?.slice(0, 120));
	}

	// 5b: screener_technical_indicators_latest (hot table for query engine)
	try {
		await p1Db.execute(p1Sql`
      CREATE TABLE IF NOT EXISTS screener_technical_indicators_latest (
        symbol              VARCHAR PRIMARY KEY,
        date                VARCHAR,
        timeframe           VARCHAR DEFAULT 'daily',
        open                DECIMAL(15,4), high DECIMAL(15,4), low DECIMAL(15,4),
        close               DECIMAL(15,4), volume DECIMAL(20,0),
        rsi_14              DECIMAL(10,4),
        macd                DECIMAL(15,4), macd_signal DECIMAL(15,4), macd_hist DECIMAL(15,4),
        sma_50              DECIMAL(15,4), sma_200 DECIMAL(15,4),
        adx                 DECIMAL(10,4), atr_14 DECIMAL(15,4),
        bollinger_upper     DECIMAL(15,4), bollinger_lower DECIMAL(15,4), bollinger_pct_b DECIMAL(10,4),
        week_high_52        DECIMAL(15,4), week_low_52 DECIMAL(15,4), pct_from_52w_high DECIMAL(8,4),
        technical_rating    VARCHAR,
        bullish_signals     INTEGER, bearish_signals INTEGER,
        last_updated        TIMESTAMP DEFAULT NOW()
      )
    `);
		await p1Db.execute(p1Sql`CREATE INDEX IF NOT EXISTS idx_ti_latest_rsi     ON screener_technical_indicators_latest (rsi_14)`);
		await p1Db.execute(p1Sql`CREATE INDEX IF NOT EXISTS idx_ti_latest_rating  ON screener_technical_indicators_latest (technical_rating)`);
		await p1Db.execute(p1Sql`CREATE INDEX IF NOT EXISTS idx_ti_latest_adx     ON screener_technical_indicators_latest (adx)`);
		console.log("  ✅ Phase 5b: screener_technical_indicators_latest hot table ready");
	} catch (e: any) {
		console.warn("  ⚠️  Phase 5b ti_latest create (non-fatal):", e.message?.slice(0, 120));
	}

	// 5c: Back-fill hot table from existing archive (first-time only)
	// NOTE: screener_technical_indicators stores Bollinger columns as bb_upper/bb_lower/bb_pct_b
	//       (added by Phase 3 ALTER TABLE). The _latest table uses bollinger_* names.
	//       Must alias them in the SELECT — a direct column reference would throw
	//       "column bollinger_upper does not exist" and silently skip this backfill.
	try {
		await p1Db.execute(p1Sql`
      INSERT INTO screener_technical_indicators_latest (
        symbol, date, timeframe, open, high, low, close, volume,
        rsi_14, macd, macd_signal, macd_hist, sma_50, sma_200,
        adx, atr_14, bollinger_upper, bollinger_lower, bollinger_pct_b,
        week_high_52, week_low_52, pct_from_52w_high,
        technical_rating, bullish_signals, bearish_signals, last_updated
      )
      SELECT DISTINCT ON (symbol)
        symbol, date, timeframe, open, high, low, close, volume,
        rsi_14, macd, macd_signal, macd_hist, sma_50, sma_200,
        adx, atr_14,
        bb_upper    AS bollinger_upper,
        bb_lower    AS bollinger_lower,
        bb_pct_b    AS bollinger_pct_b,
        week_high_52, week_low_52, pct_from_52w_high,
        technical_rating, bullish_signals, bearish_signals, NOW() AS last_updated
      FROM screener_technical_indicators
      ORDER BY symbol, date DESC NULLS LAST
      ON CONFLICT (symbol) DO NOTHING
    `);
		console.log("  ✅ Phase 5c: hot table back-filled from archive");
	} catch (e: any) {
		console.warn("  ⚠️  Phase 5c ti_latest back-fill (non-fatal):", e.message?.slice(0, 120));
	}

	console.log("✅ [Phase 5] Date type + hot-cold split migrations complete");
}


// ── FASP-AI v3.0 Dynamic Portfolio Management Tables ──────────────────────────
export async function runFASPAIv3Migrations(): Promise<void> {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { sql: migSql } = await import("drizzle-orm");

  const migDb = drizzle(neon(process.env.DATABASE_URL!));

  // 1. fund_performance_cache — live NAV + rolling returns
  try {
    await migDb.execute(migSql`
      CREATE TABLE IF NOT EXISTS fund_performance_cache (
        isin               VARCHAR(20)         PRIMARY KEY,
        scheme_code        VARCHAR(12),
        scheme_name        VARCHAR(300),
        asset_class        VARCHAR(50),
        category           VARCHAR(100),
        risk_rating        VARCHAR(20),
        current_nav        NUMERIC(12,4),
        nav_date           DATE,
        cagr_1m            NUMERIC(6,2),
        cagr_3m            NUMERIC(6,2),
        cagr_6m            NUMERIC(6,2),
        cagr_1y            NUMERIC(6,2),
        cagr_3y            NUMERIC(6,2),
        alpha_vs_nifty     NUMERIC(6,2),
        alpha_vs_crisil    NUMERIC(6,2),
        sharpe_ratio       NUMERIC(6,3),
        sortino_ratio      NUMERIC(6,3),
        max_drawdown       NUMERIC(6,2),
        volatility         NUMERIC(6,2),
        aum_cr             NUMERIC(14,2),
        expense_ratio      NUMERIC(5,3),
        alpha_score        NUMERIC(6,2),
        nav_updated_at     TIMESTAMP,
        returns_updated_at TIMESTAMP,
        engine_version     VARCHAR(30)  DEFAULT 'FASP-AI-v3.0',
        source             VARCHAR(20)  DEFAULT 'cron',
        created_at         TIMESTAMP    DEFAULT NOW(),
        updated_at         TIMESTAMP    DEFAULT NOW()
      )
    `);
    await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_fpc_asset_class ON fund_performance_cache(asset_class)`);
    await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_fpc_alpha_score ON fund_performance_cache(alpha_score DESC)`);
    await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_fpc_nav_date ON fund_performance_cache(nav_date)`);
    console.log("  ✅ fund_performance_cache: created");
  } catch (e: any) {
    console.warn("  ⚠️  fund_performance_cache (non-fatal):", e.message?.slice(0, 80));
  }

  // 2. rebalance_proposals — advisor-reviewed substitution plans
  try {
    await migDb.execute(migSql`
      CREATE TABLE IF NOT EXISTS rebalance_proposals (
        id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        portfolio_id     VARCHAR(100) NOT NULL REFERENCES model_portfolios(id),
        proposed_at      TIMESTAMP    DEFAULT NOW(),
        proposed_by      VARCHAR(50)  DEFAULT 'FASP-AI-v3.0',
        engine_version   VARCHAR(30)  DEFAULT 'FASP-AI-v3.0',
        status           VARCHAR(20)  DEFAULT 'pending',
        reviewed_by      VARCHAR(100),
        reviewed_at      TIMESTAMP,
        rejection_reason TEXT,
        substitutions    JSONB        NOT NULL DEFAULT '[]',
        total_alpha_gain NUMERIC(6,2),
        confidence       INTEGER      DEFAULT 0,
        drift_severity   VARCHAR(20),
        executed_at      TIMESTAMP,
        execution_notes  TEXT,
        disclaimer       TEXT         DEFAULT 'Past performance is not indicative of future results. Advisor approval required.',
        source           VARCHAR(20)  DEFAULT 'system',
        created_at       TIMESTAMP    DEFAULT NOW(),
        updated_at       TIMESTAMP    DEFAULT NOW()
      )
    `);
    await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_rp_portfolio_status ON rebalance_proposals(portfolio_id, status)`);
    await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_rp_proposed_at ON rebalance_proposals(proposed_at DESC)`);
    console.log("  ✅ rebalance_proposals: created");
  } catch (e: any) {
    console.warn("  ⚠️  rebalance_proposals (non-fatal):", e.message?.slice(0, 80));
  }

  // 3. portfolio_alerts — drift/alpha/substitution notifications
  try {
    await migDb.execute(migSql`
      CREATE TABLE IF NOT EXISTS portfolio_alerts (
        id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        portfolio_id  VARCHAR(100) REFERENCES model_portfolios(id),
        alert_type    VARCHAR(50)  NOT NULL,
        severity      VARCHAR(20)  NOT NULL DEFAULT 'info',
        title         VARCHAR(200) NOT NULL,
        message       TEXT         NOT NULL,
        metadata      JSONB        DEFAULT '{}',
        is_read       BOOLEAN      DEFAULT FALSE,
        snoozed_until TIMESTAMP,
        expires_at    TIMESTAMP,
        dedup_key     VARCHAR(200),
        engine_version VARCHAR(30) DEFAULT 'FASP-AI-v3.0',
        source        VARCHAR(20)  DEFAULT 'system',
        created_at    TIMESTAMP    DEFAULT NOW(),
        updated_at    TIMESTAMP    DEFAULT NOW(),
        UNIQUE(dedup_key)
      )
    `);
    await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_pa_portfolio_read ON portfolio_alerts(portfolio_id, is_read)`);
    await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_pa_alert_type ON portfolio_alerts(alert_type, severity)`);
    await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_pa_created ON portfolio_alerts(created_at DESC)`);
    console.log("  ✅ portfolio_alerts: created");
  } catch (e: any) {
    console.warn("  ⚠️  portfolio_alerts (non-fatal):", e.message?.slice(0, 80));
  }

  console.log("  ✅ [FASP-AI v3.0] All dynamic portfolio management tables created");
}

// ── Phase B — model_portfolio_holdings unique index ───────────────────────────
// Required for ON CONFLICT (portfolio_id, instrument_name) upserts in the
// Phase B migration service. Non-fatal — no-op if already present.
export async function applyPhaseB_HoldingsUniqueIndex(): Promise<void> {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { sql: migSql } = await import("drizzle-orm");
  const migDb = drizzle(neon(process.env.DATABASE_URL!));
  try {
    await migDb.execute(migSql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_mph_portfolio_instrument
      ON model_portfolio_holdings (portfolio_id, instrument_name)
    `);
    console.log("  ✅ [Phase B] model_portfolio_holdings unique index: uq_mph_portfolio_instrument");
  } catch (e: any) {
    console.warn("  ⚠️  [Phase B] uq_mph_portfolio_instrument (non-fatal):", e.message?.slice(0, 80));
  }
}

// ── De-duplication: Consolidated table DDL ────────────────────────────────────
// agent_notifications was previously created in 11 separate admin route files.
// partner_team_members + partner_agent_invitations in 2 partner route files.
// All route-level `ensure*` functions now guard with a hasRun flag and are
// instant no-ops after this canonical startup migration runs first.
export async function ensureSharedRouteTables(): Promise<void> {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { sql: migSql } = await import("drizzle-orm");
  const migDb = drizzle(neon(process.env.DATABASE_URL!));

  // ── agent_notifications ─────────────────────────────────────────────────────
  try {
    await migDb.execute(migSql`
      CREATE TABLE IF NOT EXISTS agent_notifications (
        id          SERIAL PRIMARY KEY,
        agent_id    VARCHAR(255) NOT NULL,
        title       TEXT NOT NULL,
        body        TEXT NOT NULL,
        type        TEXT NOT NULL DEFAULT 'info',
        link        TEXT,
        read_at     TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await migDb.execute(migSql`
      CREATE INDEX IF NOT EXISTS idx_agent_notifications_agent_id
      ON agent_notifications (agent_id)
    `);
    console.log("  ✅ agent_notifications: ready");
  } catch (e: any) {
    console.warn("  ⚠️  agent_notifications (non-fatal):", e.message?.slice(0, 80));
  }

  // ── partner_team_members ────────────────────────────────────────────────────
  try {
    await migDb.execute(migSql`
      CREATE TABLE IF NOT EXISTS partner_team_members (
        id                   SERIAL PRIMARY KEY,
        partner_user_id      VARCHAR(255) NOT NULL,
        agent_user_id        VARCHAR(255) NOT NULL,
        role                 TEXT NOT NULL DEFAULT 'agent',
        commission_split_pct NUMERIC(5,2) DEFAULT 0,
        status               TEXT NOT NULL DEFAULT 'active',
        joined_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (partner_user_id, agent_user_id)
      )
    `);
    console.log("  ✅ partner_team_members: ready");
  } catch (e: any) {
    console.warn("  ⚠️  partner_team_members (non-fatal):", e.message?.slice(0, 80));
  }

  // ── partner_agent_invitations ───────────────────────────────────────────────
  try {
    await migDb.execute(migSql`
      CREATE TABLE IF NOT EXISTS partner_agent_invitations (
        id                   SERIAL PRIMARY KEY,
        partner_user_id      VARCHAR(255) NOT NULL,
        invite_code          VARCHAR(50) NOT NULL UNIQUE,
        invitee_name         TEXT,
        invitee_email        TEXT,
        invitee_mobile       TEXT,
        status               TEXT NOT NULL DEFAULT 'pending',
        accepted_by_user_id  VARCHAR(255),
        accepted_at          TIMESTAMPTZ,
        expires_at           TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("  ✅ partner_agent_invitations: ready");
  } catch (e: any) {
    console.warn("  ⚠️  partner_agent_invitations (non-fatal):", e.message?.slice(0, 80));
  }

  // ── Fix 1: model_portfolio_holdings — inception_nav + inception_date ────────
  // These columns power the accurate drift formula introduced in FASP-AI v3.0.
  //
  // Drift formula (v3.0):
  //   currentWeight = targetWeight × (currentNAV / inceptionNAV)
  //   drift         = currentWeight − targetWeight
  //
  // inceptionNav  = NAV at the time the holding was added to the portfolio.
  //                 Populated by refreshHoldingNAV() on first NAV fetch (self-healing:
  //                 if null, sets inceptionNav = currentNav so drift starts at 0).
  // inceptionDate = The calendar date inceptionNav was recorded.
  //
  // Without these columns, the old formula (nav × weight / Σ(nav × weight)) mixes
  // ₹/unit with %, making drift dimensionally wrong for every portfolio.
  //
  // ADD COLUMN IF NOT EXISTS is idempotent — safe to run on every restart.
  try {
    await migDb.execute(migSql`
      ALTER TABLE model_portfolio_holdings
        ADD COLUMN IF NOT EXISTS inception_nav  NUMERIC(12, 4),
        ADD COLUMN IF NOT EXISTS inception_date DATE
    `);
    // Backfill: for any existing holdings where inception_nav is null but
    // current_nav is already populated, set inception_nav = current_nav.
    // This means the first drift reading after migration will be 0 (baseline),
    // and subsequent NAV refreshes will compute real drift from this point.
    await migDb.execute(migSql`
      UPDATE model_portfolio_holdings
      SET
        inception_nav  = current_nav,
        inception_date = COALESCE(nav_date, CURRENT_DATE)
      WHERE
        inception_nav IS NULL
        AND current_nav IS NOT NULL
    `);
    console.log("  ✅ model_portfolio_holdings: inception_nav + inception_date (Fix 1 — v3.0 drift baseline)");
  } catch (e: any) {
    console.warn("  ⚠️  model_portfolio_holdings inception_nav migration (non-fatal):", e.message?.slice(0, 120));
  }

  // ── Fix 14: model_portfolios — quant_risk_metrics JSONB ─────────────────────
  // Stores VaR-95, CVaR-95, Sortino ratio, dynamic confidence score from backtest.
  // Required for SEBI 2023 investment advisory risk disclosure compliance.
  try {
    await migDb.execute(migSql`
      ALTER TABLE model_portfolios
        ADD COLUMN IF NOT EXISTS quant_risk_metrics JSONB DEFAULT '{}'::jsonb
    `);
    console.log("  ✅ model_portfolios: quant_risk_metrics (Fix 14 — VaR/CVaR/dynamic confidence)");
  } catch (e: any) {
    console.warn("  ⚠️  model_portfolios quant_risk_metrics migration (non-fatal):", e.message?.slice(0, 120));
  }

  // ── Fix 15: model_portfolios — SEBI compliance + return optimisation columns ─
  // Adds: portfolio_code (FP-NNN), inception_date, twrr_1y/3y (SEBI-mandated TWRR),
  //       blended_benchmark_return, drift_threshold (per-class), max_drawdown_threshold,
  //       conflict_disclosure (SEBI IA Regs distributor trail disclosure).
  try {
    await migDb.execute(migSql`
      ALTER TABLE model_portfolios
        ADD COLUMN IF NOT EXISTS portfolio_code           VARCHAR(20),
        ADD COLUMN IF NOT EXISTS inception_date           DATE,
        ADD COLUMN IF NOT EXISTS twrr_1y                 NUMERIC(8,4),
        ADD COLUMN IF NOT EXISTS twrr_3y                 NUMERIC(8,4),
        ADD COLUMN IF NOT EXISTS blended_benchmark_return NUMERIC(8,4),
        ADD COLUMN IF NOT EXISTS drift_threshold          NUMERIC(5,2)  DEFAULT 5,
        ADD COLUMN IF NOT EXISTS max_drawdown_threshold   NUMERIC(5,2),
        ADD COLUMN IF NOT EXISTS conflict_disclosure      TEXT
    `);
    // Back-fill portfolio_code as FP-NNN using row_number over creation order
    await migDb.execute(migSql`
      UPDATE model_portfolios mp
      SET portfolio_code = sub.code
      FROM (
        SELECT id,
               'FP-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at, id)::text, 3, '0') AS code
        FROM model_portfolios
        WHERE portfolio_code IS NULL
      ) sub
      WHERE mp.id = sub.id AND mp.portfolio_code IS NULL
    `);
    // Back-fill per-class drift thresholds based on asset_class
    await migDb.execute(migSql`
      UPDATE model_portfolios SET drift_threshold = 1
      WHERE (id ILIKE '%overnight%' OR id ILIKE '%treasury%') AND drift_threshold = 5
    `);
    await migDb.execute(migSql`
      UPDATE model_portfolios SET drift_threshold = 2
      WHERE (asset_class = 'debt' OR id ILIKE '%emergency%' OR id ILIKE '%liquid%') AND drift_threshold = 5
    `);
    await migDb.execute(migSql`
      UPDATE model_portfolios SET drift_threshold = 7
      WHERE (asset_class = 'thematic' OR id ILIKE '%smallcap%' OR id ILIKE '%small-cap%'
             OR id ILIKE '%midcap%' OR id ILIKE '%mid-cap%') AND drift_threshold = 5
    `);
    // Back-fill max_drawdown_threshold by risk_profile
    await migDb.execute(migSql`
      UPDATE model_portfolios SET max_drawdown_threshold =
        CASE risk_profile
          WHEN 'conservative' THEN 8
          WHEN 'moderate'     THEN 15
          WHEN 'aggressive'   THEN 25
          ELSE 20
        END
      WHERE max_drawdown_threshold IS NULL
    `);
    console.log("  ✅ model_portfolios: Fix 15 — portfolio_code, inception_date, TWRR, blended benchmark, drift/drawdown thresholds, conflict_disclosure");
  } catch (e: any) {
    console.warn("  ⚠️  model_portfolios Fix 15 columns migration (non-fatal):", e.message?.slice(0, 120));
  }

  // ── Fix IM-1: Drop orphan instrument cache tables ─────────────────────────
  // financial_instruments_cache and stock_prices_cache have 0 reads and 0 writes
  // across all server files. Superseded by listed_stocks.currentPrice.
  try {
    await migDb.execute(migSql`DROP TABLE IF EXISTS financial_instruments_cache CASCADE`);
    await migDb.execute(migSql`DROP TABLE IF EXISTS stock_prices_cache CASCADE`);
    console.log("  ✅ Fix IM-1: dropped orphan tables financial_instruments_cache, stock_prices_cache");
  } catch (e: any) {
    console.warn("  ⚠️  Fix IM-1 orphan table drop (non-fatal):", e.message?.slice(0, 120));
  }

  // ── Fix IM-2: Add missing instrument-level columns to bond_catalog ────────
  // corporate_bonds conflated master data with holdings. The instrument-level
  // fields go to bond_catalog so it serves as the single bond master.
  try {
    await migDb.execute(migSql`
      ALTER TABLE bond_catalog
        ADD COLUMN IF NOT EXISTS bond_type            VARCHAR(50),
        ADD COLUMN IF NOT EXISTS coupon_type          VARCHAR(30),
        ADD COLUMN IF NOT EXISTS tenor_years          NUMERIC(5,2),
        ADD COLUMN IF NOT EXISTS issue_price          NUMERIC(15,4),
        ADD COLUMN IF NOT EXISTS current_price        NUMERIC(15,4),
        ADD COLUMN IF NOT EXISTS listing_date         DATE,
        ADD COLUMN IF NOT EXISTS trading_status       VARCHAR(20) DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS is_callable          BOOLEAN     DEFAULT false,
        ADD COLUMN IF NOT EXISTS call_date            DATE,
        ADD COLUMN IF NOT EXISTS call_price           NUMERIC(15,4),
        ADD COLUMN IF NOT EXISTS is_puttable          BOOLEAN     DEFAULT false,
        ADD COLUMN IF NOT EXISTS put_date             DATE,
        ADD COLUMN IF NOT EXISTS put_price            NUMERIC(15,4),
        ADD COLUMN IF NOT EXISTS secured              BOOLEAN     DEFAULT false,
        ADD COLUMN IF NOT EXISTS security_code        VARCHAR(50),
        ADD COLUMN IF NOT EXISTS duration             NUMERIC(8,4),
        ADD COLUMN IF NOT EXISTS modified_duration    NUMERIC(8,4),
        ADD COLUMN IF NOT EXISTS convexity            NUMERIC(10,4),
        ADD COLUMN IF NOT EXISTS last_traded_price    NUMERIC(15,4),
        ADD COLUMN IF NOT EXISTS last_traded_date     DATE,
        ADD COLUMN IF NOT EXISTS volume               INTEGER,
        ADD COLUMN IF NOT EXISTS yield_to_call        NUMERIC(8,4),
        ADD COLUMN IF NOT EXISTS issuer_sector        VARCHAR(100),
        ADD COLUMN IF NOT EXISTS issuer_industry      VARCHAR(100),
        ADD COLUMN IF NOT EXISTS structure_complexity INTEGER,
        ADD COLUMN IF NOT EXISTS liquidity_score      INTEGER,
        ADD COLUMN IF NOT EXISTS sebi_approved        BOOLEAN     DEFAULT false,
        ADD COLUMN IF NOT EXISTS instrument_status    VARCHAR(16) DEFAULT 'HIDDEN',
        ADD COLUMN IF NOT EXISTS indexation_benefit   BOOLEAN     DEFAULT false,
        ADD COLUMN IF NOT EXISTS security_type        VARCHAR(50),
        ADD COLUMN IF NOT EXISTS collateral_type      TEXT,
        ADD COLUMN IF NOT EXISTS special_features     JSONB       DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT NOW()
    `);
    console.log("  ✅ Fix IM-2: bond_catalog — 30 instrument-level columns added");
  } catch (e: any) {
    console.warn("  ⚠️  Fix IM-2 bond_catalog columns (non-fatal):", e.message?.slice(0, 120));
  }

  // ── Fix IM-3: Add enrichment-tracking columns to listed_stocks ────────────
  // Adds per-category sync timestamps from screener_stocks so screener services
  // can write directly to listed_stocks (single stock master).
  try {
    await migDb.execute(migSql`
      ALTER TABLE listed_stocks
        ADD COLUMN IF NOT EXISTS last_financials_sync    TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_technicals_sync    TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_shareholding_sync  TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_key_metrics_sync   TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS fmp_symbol              VARCHAR(20),
        ADD COLUMN IF NOT EXISTS market_cap_category     VARCHAR(20)
    `);
    console.log("  ✅ Fix IM-3: listed_stocks — 6 screener-merge columns added");
  } catch (e: any) {
    console.warn("  ⚠️  Fix IM-3 listed_stocks screener columns (non-fatal):", e.message?.slice(0, 120));
  }

  // ── Fix IM-4: Extend mf_monthwise_performance to cover AIF/PMS funds ──────
  // fund_performance_monthwise (7 files) stores monthly returns for AIF+PMS.
  // Adding fund_type + fund_id unifies all monthly perf into one table.
  try {
    await migDb.execute(migSql`
      ALTER TABLE mf_monthwise_performance
        ADD COLUMN IF NOT EXISTS fund_type   VARCHAR(20) DEFAULT 'mutual_fund',
        ADD COLUMN IF NOT EXISTS fund_id     VARCHAR(255),
        ADD COLUMN IF NOT EXISTS nav_end     NUMERIC(15,4),
        ADD COLUMN IF NOT EXISTS return_pct  NUMERIC(8,4)
    `);
    console.log("  ✅ Fix IM-4: mf_monthwise_performance — fund_type, fund_id, nav_end, return_pct added");
  } catch (e: any) {
    console.warn("  ⚠️  Fix IM-4 mf_monthwise_performance columns (non-fatal):", e.message?.slice(0, 120));
  }

  // ── Fix IM-5: AMFI bulk import if mutual_funds is empty ───────────────────
  // mutual_funds has 0 rows in production despite 138 server files depending on it.
  // Fire-and-forget after boot so startup is not delayed.
  try {
    const mfCountResult = await migDb.execute(
      migSql`SELECT COUNT(*)::int AS cnt FROM mutual_funds`
    );
    const mfCount = Number((mfCountResult as any).rows?.[0]?.cnt ?? 0);
    if (mfCount === 0) {
      console.log("  ⚠️  mutual_funds table is EMPTY — triggering background AMFI import (~18k schemes)...");
      import("../services/amfi-import-service")
        .then(({ importAmfiData }: { importAmfiData: () => Promise<any> }) =>
          importAmfiData()
        )
        .then((result: any) => {
          console.log(
            `  ✅ Fix IM-5: AMFI import complete — imported: ${result?.imported ?? "?"}, updated: ${result?.updated ?? "?"}`
          );
        })
        .catch((err: Error) => {
          console.warn("  ⚠️  Fix IM-5: AMFI import failed (non-fatal):", err.message?.slice(0, 120));
        });
    } else {
      console.log(`  ✅ Fix IM-5: mutual_funds has ${mfCount} rows — AMFI seed not needed`);
    }
  } catch (e: any) {
    console.warn("  ⚠️  Fix IM-5 mutual_funds seed check (non-fatal):", e.message?.slice(0, 120));
  }

  // ── Fix IM-6: listed_stocks — add fmp_symbol + last_fmp_sync columns ────────
  // Required for Phase 3: screener enrichment now writes to listed_stocks.
  // These mirror screener_stocks.fmp_symbol / last_fmp_sync so enrichment-service
  // can track FMP sync freshness on the master table.
  try {
    await migDb.execute(migSql`
      ALTER TABLE listed_stocks
        ADD COLUMN IF NOT EXISTS exchange           VARCHAR(20)  DEFAULT 'NSE',
        ADD COLUMN IF NOT EXISTS country            VARCHAR(10)  DEFAULT 'IN',
        ADD COLUMN IF NOT EXISTS currency           VARCHAR(10)  DEFAULT 'INR',
        ADD COLUMN IF NOT EXISTS fmp_symbol         VARCHAR(50),
        ADD COLUMN IF NOT EXISTS last_fmp_sync      TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS market_cap_category VARCHAR(50)
    `);
    console.log("  ✅ Fix IM-6: listed_stocks — exchange, country, currency, fmp_symbol, last_fmp_sync, market_cap_category added");
  } catch (e: any) {
    console.warn("  ⚠️  Fix IM-6 listed_stocks fmp columns (non-fatal):", e.message?.slice(0, 120));
  }

  // ── Fix IM-7: screener_stocks compat VIEW (Phase 3) ─────────────────────────
  // Create a VIEW that maps listed_stocks columns back to the old screener_stocks
  // column names. This allows any SQL that still references screener_stocks to
  // transparently read from listed_stocks during the migration window.
  // DROP + CREATE is safe here since it's a view, not a table — no data loss.
  try {
    await migDb.execute(migSql`
      CREATE OR REPLACE VIEW screener_stocks AS
      SELECT
        id,
        symbol,
        company_name         AS company_name,
        'NSE'                AS exchange,
        isin,
        sector,
        industry,
        market_cap           AS market_cap_category,
        'IN'                 AS country,
        'INR'                AS currency,
        is_active,
        current_price,
        market_cap_value,
        fmp_symbol,
        last_fmp_sync,
        'fmp'                AS data_source,
        NULL::timestamptz    AS last_financials_sync,
        NULL::timestamptz    AS last_technicals_sync,
        NULL::timestamptz    AS last_shareholding_sync,
        NULL::timestamptz    AS last_key_metrics_sync,
        created_at,
        last_updated         AS updated_at
      FROM listed_stocks
      WHERE is_active = true
    `);
    console.log("  ✅ Fix IM-7: screener_stocks compat VIEW created → listed_stocks");
  } catch (e: any) {
    console.warn("  ⚠️  Fix IM-7 screener_stocks view (non-fatal):", e.message?.slice(0, 120));
  }

  // ── Fix IM-8: mf_monthly_returns compat VIEW (Phase 4) ───────────────────────
  // mf_monthly_returns was a duplicate of mf_monthwise_performance.
  // Any raw SQL that still references it will transparently read from the canonical table.
  try {
    await migDb.execute(migSql`
      CREATE OR REPLACE VIEW mf_monthly_returns AS
      SELECT
        id,
        scheme_code,
        month_year,
        return_percent,
        nav_start,
        nav_end,
        start_date,
        end_date,
        'mutual_fund'  AS fund_type,
        NULL::varchar  AS fund_id,
        return_pct,
        created_at,
        updated_at
      FROM mf_monthwise_performance
    `);
    console.log("  ✅ Fix IM-8: mf_monthly_returns compat VIEW created → mf_monthwise_performance");
  } catch (e: any) {
    console.warn("  ⚠️  Fix IM-8 mf_monthly_returns view (non-fatal):", e.message?.slice(0, 120));
  }

  // ── Fix IM-9: fund_performance_monthwise compat VIEW (Phase 4) ───────────────
  // fund_performance_monthwise stored AIF+PMS monthly returns — now merged via
  // fund_type + fund_id columns added to mf_monthwise_performance in Phase 1.
  try {
    await migDb.execute(migSql`
      CREATE OR REPLACE VIEW fund_performance_monthwise AS
      SELECT
        id,
        fund_id,
        fund_type,
        month_year,
        return_percent,
        nav_start,
        nav_end,
        start_date,
        end_date,
        created_at,
        updated_at
      FROM mf_monthwise_performance
      WHERE fund_type IN ('aif', 'pms')
    `);
    console.log("  ✅ Fix IM-9: fund_performance_monthwise compat VIEW created → mf_monthwise_performance");
  } catch (e: any) {
    console.warn("  ⚠️  Fix IM-9 fund_performance_monthwise view (non-fatal):", e.message?.slice(0, 120));
  }

  // ── Fix IM-10: aif_funds compat VIEW (Phase 4) ────────────────────────────────
  // aif_funds had only 1 route usage. IRIS API is now authoritative → aif_master.
  try {
    await migDb.execute(migSql`
      CREATE OR REPLACE VIEW aif_funds AS
      SELECT
        id,
        fund_name,
        fund_manager,
        category,
        sub_category,
        inception_date,
        aum,
        vintage,
        irr,
        nav,
        hurdle_rate,
        management_fee,
        performance_fee,
        lock_in_period,
        risk_level,
        minimum_investment,
        sebi_registration_number,
        data_source,
        is_active,
        created_at,
        updated_at
      FROM aif_master
    `);
    console.log("  ✅ Fix IM-10: aif_funds compat VIEW created → aif_master");
  } catch (e: any) {
    console.warn("  ⚠️  Fix IM-10 aif_funds view (non-fatal):", e.message?.slice(0, 120));
  }

  // ── Fix FASP-1: portfolio_ai_decisions ─────────────────────────────────────
  try {
    await migDb.execute(migSql`
      CREATE TABLE IF NOT EXISTS portfolio_ai_decisions (
        id                       SERIAL PRIMARY KEY,
        portfolio_id             VARCHAR NOT NULL REFERENCES model_portfolios(id) ON DELETE CASCADE,
        portfolio_code           VARCHAR,
        decided_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        decision_type            TEXT NOT NULL,
        trigger                  TEXT NOT NULL,
        chosen_scheme_code       TEXT,
        chosen_isin              TEXT,
        chosen_name              TEXT NOT NULL,
        chosen_weight_pct        REAL,
        chosen_nav_at_decision   NUMERIC(15,4),
        rejected_scheme_code     TEXT,
        rejected_isin            TEXT,
        rejected_name            TEXT,
        rejected_nav_at_decision NUMERIC(15,4),
        rationale_code           TEXT NOT NULL,
        rationale_detail         TEXT NOT NULL,
        ai_confidence_score      REAL,
        model_version            TEXT NOT NULL DEFAULT 'FASP-AI-v2.0',
        outcome_period_months    INTEGER,
        outcome_return_pct       REAL,
        outcome_benchmark_pct    REAL,
        rejected_return_pct      REAL,
        alpha_captured_pct       REAL,
        is_win                   BOOLEAN,
        outcome_computed_at      TIMESTAMPTZ,
        advisor_id               TEXT,
        advisor_approved_at      TIMESTAMPTZ,
        advisor_notes            TEXT,
        proposal_id              TEXT,
        source                   TEXT NOT NULL DEFAULT 'fasp_ai',
        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_pad_portfolio_decided ON portfolio_ai_decisions(portfolio_id, decided_at DESC)`);
    await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_pad_chosen_scheme ON portfolio_ai_decisions(chosen_scheme_code)`);
    await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_pad_outcome_pending ON portfolio_ai_decisions(outcome_computed_at)`);
    await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_pad_decision_type ON portfolio_ai_decisions(decision_type)`);
    console.log("  \u2705 Fix FASP-1: portfolio_ai_decisions created (FASP-AI track record)");
  } catch (e: any) {
    console.warn("  \u26a0\ufe0f  Fix FASP-1 portfolio_ai_decisions (non-fatal):", e.message?.slice(0, 120));
  }

  // ── Fix FASP-2: portfolio_rebalance_events ───────────────────────────────────
  try {
    await migDb.execute(migSql`
      CREATE TABLE IF NOT EXISTS portfolio_rebalance_events (
        id                   SERIAL PRIMARY KEY,
        portfolio_id         VARCHAR NOT NULL REFERENCES model_portfolios(id) ON DELETE CASCADE,
        triggered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        trigger_type         TEXT NOT NULL,
        drift_score_at_trigger INTEGER,
        drift_threshold_pct  REAL,
        holdings_drift       JSONB,
        action_taken         TEXT NOT NULL,
        deferral_reason      TEXT,
        advisor_id           TEXT,
        proposal_id          TEXT,
        engine_version       TEXT DEFAULT 'FASP-AI-v2.0',
        source               TEXT DEFAULT 'system',
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_pre_portfolio_triggered ON portfolio_rebalance_events(portfolio_id, triggered_at DESC)`);
    console.log("  \u2705 Fix FASP-2: portfolio_rebalance_events created (drift audit log)");
  } catch (e: any) {
    console.warn("  \u26a0\ufe0f  Fix FASP-2 portfolio_rebalance_events (non-fatal):", e.message?.slice(0, 120));
  }

  // ── Fix FASP-3: backfill inception_date ──────────────────────────────────────
  try {
    const nullPorts = await migDb.execute(migSql`
      SELECT id, holdings FROM model_portfolios WHERE inception_date IS NULL
    `);
    for (const port of nullPorts.rows as any[]) {
      try {
        const hArr = JSON.parse(port.holdings ?? "[]");
        const match = hArr.find((h: any) => h.amfiSchemeCode || h.schemeCode);
        const sc: string | null = match?.amfiSchemeCode ?? match?.schemeCode ?? null;
        if (!sc) continue;
        const res = await migDb.execute(migSql`
          SELECT MIN(month_year) AS earliest FROM mf_monthwise_performance WHERE scheme_code = ${sc}
        `);
        const dt: string | null = (res.rows[0] as any)?.earliest ?? null;
        if (!dt) continue;
        await migDb.execute(migSql`
          UPDATE model_portfolios SET inception_date = ${dt} WHERE id = ${port.id}
        `);
      } catch { /* per-portfolio failure is non-fatal */ }
    }
    console.log("  \u2705 Fix FASP-3: inception_date backfilled from mf_monthwise_performance");
  } catch (e: any) {
    console.warn("  \u26a0\ufe0f  Fix FASP-3 inception_date backfill (non-fatal):", e.message?.slice(0, 120));
  }

  // ── Fix FASP-4: Materialised period return columns on model_portfolios ──────────
  // ADD COLUMN IF NOT EXISTS — safe to run on every boot.
  const phase4Cols: Array<[string, string]> = [
    ["return_1m",                "NUMERIC(8,4)"],
    ["return_3m",                "NUMERIC(8,4)"],
    ["return_6m",                "NUMERIC(8,4)"],
    ["return_ytd",               "NUMERIC(8,4)"],
    ["cagr_2y",                  "NUMERIC(8,4)"],
    ["return_since_inception",   "NUMERIC(8,4)"],
    ["benchmark_since_inception","NUMERIC(8,4)"],
    ["periods_computed_at",      "TIMESTAMPTZ"],
  ];
  let p4ok = 0;
  for (const [col, colType] of phase4Cols) {
    try {
      // Use raw string to avoid drizzle template literal parsing of SQL identifiers
      await migDb.execute({ sql: `ALTER TABLE model_portfolios ADD COLUMN IF NOT EXISTS "${col}" ${colType}`, params: [] } as any);
      p4ok++;
    } catch (e: any) {
      console.warn(`  ⚠️  Fix FASP-4 col ${col} (non-fatal):`, e.message?.slice(0, 80));
    }
  }
  console.log(`  ✅ Fix FASP-4: ${p4ok}/${phase4Cols.length} period columns ensured`);
}
