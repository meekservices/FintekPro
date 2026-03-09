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

    console.log("✅ [GoldenPricing] DB tables ready (golden_prices, price_audit_log)");
  } catch (e: any) {
    console.error("[GoldenPricing] Migration error:", e?.message);
  }
}
