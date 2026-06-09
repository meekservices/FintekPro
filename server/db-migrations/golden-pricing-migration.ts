/**
 * Boot-time migration for Golden Source Pricing Engine tables.
 * Runs CREATE TABLE IF NOT EXISTS — safe to call on every startup.
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

export async function runGoldenPricingMigration(): Promise<void> {
	try {
		await db.execute(sql`
      CREATE TABLE IF NOT EXISTS golden_prices (
        id SERIAL PRIMARY KEY,
        isin VARCHAR(20) NOT NULL,
        symbol VARCHAR(50),
        price_date DATE NOT NULL,
        asset_class VARCHAR(30) NOT NULL DEFAULT 'equity',
        price NUMERIC(20,6) NOT NULL,
        open_price NUMERIC(20,6),
        high_price NUMERIC(20,6),
        low_price NUMERIC(20,6),
        volume NUMERIC(20,0),
        change_percent NUMERIC(10,4),
        source VARCHAR(50) NOT NULL,
        confidence_score INTEGER NOT NULL DEFAULT 50,
        is_validated BOOLEAN NOT NULL DEFAULT FALSE,
        is_stale BOOLEAN NOT NULL DEFAULT FALSE,
        is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
        flag_reason TEXT,
        previous_price NUMERIC(20,6),
        deviation_pct NUMERIC(10,4),
        currency VARCHAR(10) DEFAULT 'INR',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT idx_golden_prices_isin_date UNIQUE (isin, price_date)
      )
    `);

		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_golden_prices_date ON golden_prices(price_date)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_golden_prices_symbol ON golden_prices(symbol)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_golden_prices_asset_class ON golden_prices(asset_class)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_golden_prices_flagged ON golden_prices(is_flagged)
    `);

		await db.execute(sql`
      CREATE TABLE IF NOT EXISTS price_audit_log (
        id SERIAL PRIMARY KEY,
        isin VARCHAR(20) NOT NULL,
        price_date DATE NOT NULL,
        old_price NUMERIC(20,6),
        new_price NUMERIC(20,6) NOT NULL,
        old_source VARCHAR(50),
        new_source VARCHAR(50) NOT NULL,
        change_reason TEXT NOT NULL,
        changed_by VARCHAR(100) NOT NULL DEFAULT 'system',
        confidence_score INTEGER,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_price_audit_isin ON price_audit_log(isin)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_price_audit_date ON price_audit_log(price_date)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_price_audit_created ON price_audit_log(created_at)
    `);

		await db.execute(sql`
      CREATE TABLE IF NOT EXISTS instrument_returns (
        id SERIAL PRIMARY KEY,
        isin VARCHAR(20) NOT NULL,
        symbol VARCHAR(50),
        as_of_date DATE NOT NULL,
        asset_class VARCHAR(30) NOT NULL DEFAULT 'equity',
        current_price NUMERIC(20,6),
        return_1d NUMERIC(10,8),
        return_1w NUMERIC(10,8),
        return_1m NUMERIC(10,8),
        return_3m NUMERIC(10,8),
        return_6m NUMERIC(10,8),
        return_ytd NUMERIC(10,8),
        return_1y NUMERIC(10,8),
        return_3y NUMERIC(10,8),
        return_5y NUMERIC(10,8),
        price_1d_ago NUMERIC(20,6),
        price_1w_ago NUMERIC(20,6),
        price_1m_ago NUMERIC(20,6),
        price_3m_ago NUMERIC(20,6),
        price_6m_ago NUMERIC(20,6),
        price_1y_ago NUMERIC(20,6),
        abs_change_1d NUMERIC(20,6),
        computed_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(isin, as_of_date)
      )
    `);

		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_instr_ret_isin ON instrument_returns(isin)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_instr_ret_date ON instrument_returns(as_of_date)
    `);

		console.log(
			"✅ [GoldenPricing] DB tables ready (golden_prices, price_audit_log, instrument_returns)",
		);
	} catch (e: any) {
		console.error("[GoldenPricing] Migration error:", e?.message);
	}
}
