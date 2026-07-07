/**
 * Boot-time migration for Institutional Market Data Layer tables.
 * Runs CREATE TABLE IF NOT EXISTS + CREATE VIEW — safe to call on every startup.
 *
 * Tables created:
 *   corporate_actions     — splits, bonuses, dividends, rights, mergers
 *   price_adjustments     — immutable audit of every split/bonus applied to golden_prices
 *   symbol_mapping        — multi-provider symbol translation (NSE / BSE / AMFI / FMP / ...)
 *   credit_ratings        — full history of rating changes per ISIN (CRISIL / ICRA / CARE / ...)
 *   security_master (VIEW) — unified cross-asset ISIN lookup across all instrument types
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

export async function runInstitutionalDataMigration(): Promise<void> {
	try {
		// ── 1. Corporate Actions ─────────────────────────────────────────────────
		await db.execute(sql`
      CREATE TABLE IF NOT EXISTS corporate_actions (
        id SERIAL PRIMARY KEY,
        isin VARCHAR(20) NOT NULL,
        symbol VARCHAR(50),
        action_type VARCHAR(50) NOT NULL,
        ex_date DATE NOT NULL,
        record_date DATE,
        pay_date DATE,
        ratio VARCHAR(30),
        adjustment_factor NUMERIC(15,8),
        dividend_amount NUMERIC(15,4),
        purpose TEXT,
        is_applied_to_golden_prices BOOLEAN NOT NULL DEFAULT FALSE,
        applied_at TIMESTAMP,
        source VARCHAR(50) DEFAULT 'NSE',
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_corp_actions_isin ON corporate_actions(isin)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_corp_actions_ex_date ON corporate_actions(ex_date)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_corp_actions_type ON corporate_actions(action_type)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_corp_actions_applied ON corporate_actions(is_applied_to_golden_prices)
    `);
		await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_corp_actions_isin_ex_type
        ON corporate_actions(isin, ex_date, action_type)
    `);

		// ── 2. Price Adjustments (audit trail) ──────────────────────────────────
		await db.execute(sql`
      CREATE TABLE IF NOT EXISTS price_adjustments (
        id SERIAL PRIMARY KEY,
        corporate_action_id INTEGER NOT NULL,
        isin VARCHAR(20) NOT NULL,
        price_date DATE NOT NULL,
        original_price NUMERIC(20,6) NOT NULL,
        adjusted_price NUMERIC(20,6) NOT NULL,
        adjustment_factor NUMERIC(15,8) NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_price_adj_isin ON price_adjustments(isin)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_price_adj_corp_action ON price_adjustments(corporate_action_id)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_price_adj_date ON price_adjustments(price_date)
    `);

		// ── 3. Symbol Mapping ────────────────────────────────────────────────────
		await db.execute(sql`
      CREATE TABLE IF NOT EXISTS symbol_mapping (
        id SERIAL PRIMARY KEY,
        isin VARCHAR(20) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        provider_symbol VARCHAR(100) NOT NULL,
        provider_name TEXT,
        is_primary BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        last_verified_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_symbol_mapping_isin ON symbol_mapping(isin)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_symbol_mapping_provider ON symbol_mapping(provider)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_symbol_mapping_symbol ON symbol_mapping(provider_symbol)
    `);
		await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_symbol_mapping_isin_provider
        ON symbol_mapping(isin, provider)
    `);

		// ── 4. Credit Ratings ────────────────────────────────────────────────────
		await db.execute(sql`
      CREATE TABLE IF NOT EXISTS credit_ratings (
        id SERIAL PRIMARY KEY,
        isin VARCHAR(20) NOT NULL,
        instrument_name TEXT,
        rating VARCHAR(20) NOT NULL,
        rating_outlook VARCHAR(30),
        agency VARCHAR(30) NOT NULL,
        rating_date DATE NOT NULL,
        previous_rating VARCHAR(20),
        rating_action VARCHAR(40),
        is_current BOOLEAN DEFAULT TRUE,
        source VARCHAR(50) DEFAULT 'bonds_table',
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_credit_ratings_isin ON credit_ratings(isin)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_credit_ratings_agency ON credit_ratings(agency)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_credit_ratings_date ON credit_ratings(rating_date)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_credit_ratings_current ON credit_ratings(is_current)
    `);

		// ── 5. Security Master VIEW ──────────────────────────────────────────────
		// Unified cross-asset ISIN lookup. READ-ONLY view — no direct writes.
		// Consolidates: listed_stocks (equities) + mutual_funds + corporate_bonds + unlisted_companies
		//
		// Drop any conflicting non-view object (TABLE or MATERIALIZED VIEW) with the
		// same name before attempting CREATE OR REPLACE VIEW, which only works when
		// the existing object is already a regular view.
		await db.execute(sql`
      DO $$
      DECLARE obj_type text;
      BEGIN
        SELECT CASE relkind
          WHEN 'r' THEN 'TABLE'
          WHEN 'm' THEN 'MATERIALIZED VIEW'
        END INTO obj_type
        FROM pg_class
        WHERE relname = 'security_master'
          AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
          AND relkind IN ('r', 'm');
        IF obj_type IS NOT NULL THEN
          EXECUTE 'DROP ' || obj_type || ' security_master CASCADE';
        END IF;
      END$$
    `);
		await db.execute(sql`
      CREATE OR REPLACE VIEW security_master AS
        SELECT
          isin,
          company_name AS instrument_name,
          'equity'::varchar AS asset_class,
          'NSE'::varchar AS exchange,
          symbol,
          sector,
          'ACTIVE'::varchar AS status,
          CAST(current_price AS NUMERIC) AS current_price,
          'INR'::varchar AS currency,
          last_updated AS updated_at
        FROM listed_stocks
        WHERE isin IS NOT NULL
      UNION ALL
        SELECT
          isin,
          scheme_name AS instrument_name,
          'mutual_fund'::varchar AS asset_class,
          'AMFI'::varchar AS exchange,
          scheme_code AS symbol,
          category AS sector,
          COALESCE(scheme_status, 'active')::varchar AS status,
          CAST(nav AS NUMERIC) AS current_price,
          'INR'::varchar AS currency,
          NULL::timestamp AS updated_at
        FROM mutual_funds
        WHERE isin IS NOT NULL
      UNION ALL
        SELECT
          isin,
          bond_name AS instrument_name,
          'bond'::varchar AS asset_class,
          'BSE'::varchar AS exchange,
          security_code AS symbol,
          bond_type AS sector,
          instrument_status AS status,
          CAST(last_traded_price AS NUMERIC) AS current_price,
          'INR'::varchar AS currency,
          NULL::timestamp AS updated_at
        FROM bond_catalog
        WHERE isin IS NOT NULL
      UNION ALL
        SELECT
          isin,
          name AS instrument_name,
          'unlisted_equity'::varchar AS asset_class,
          'UNLISTED'::varchar AS exchange,
          NULL::varchar AS symbol,
          sector,
          status,
          CAST(COALESCE(published_buy_price, draft_buy_price) AS NUMERIC) AS current_price,
          'INR'::varchar AS currency,
          updated_at
        FROM unlisted_companies
        WHERE isin IS NOT NULL
    `);

		console.log(
			"✅ [InstitutionalData] All 4 tables + security_master view created/verified",
		);
	} catch (error: any) {
		console.error("❌ [InstitutionalData] Migration failed:", error.message);
		throw error;
	}
}
