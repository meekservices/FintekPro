/**
 * One-off script: initialise a brand-new Neon database with the full
 * FintekPro schema and restore backed-up data.
 *
 * Usage:
 *   TARGET_DB_URL="postgresql://..." npx tsx scripts/init-new-neon-db.ts
 *
 * What it does:
 *   1. Overrides PRODUCTION_DATABASE_URL → TARGET_DB_URL  (before any db import)
 *   2. Runs the three db-migration files  (golden-pricing, institutional, security-master)
 *   3. Runs all inline ALTER TABLE / CREATE TABLE migrations from server/index.ts
 *   4. Restores the two backup .sql.gz files
 */

const TARGET = process.env.TARGET_DB_URL;
if (!TARGET) {
  console.error('❌  Set TARGET_DB_URL first:');
  console.error('   TARGET_DB_URL="postgresql://..." npx tsx scripts/init-new-neon-db.ts');
  process.exit(1);
}

// MUST happen before any import that touches ./server/db
process.env.PRODUCTION_DATABASE_URL = TARGET;
process.env.NODE_ENV = 'production';

import pg from 'pg';
import fs from 'fs';
import readline from 'readline';
import { createGunzip } from 'zlib';

const { Pool } = pg;

const pool = new Pool({
  connectionString: TARGET,
  ssl: { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 30_000,
});

// ── helpers ──────────────────────────────────────────────────────────────────

async function runSQL(label: string, sqlText: string) {
  const client = await pool.connect();
  try {
    await client.query(sqlText);
    console.log(`  ✅ ${label}`);
  } catch (e: any) {
    console.error(`  ⚠️  ${label}: ${e.message}`);
  } finally {
    client.release();
  }
}

async function restoreGzip(file: string) {
  if (!fs.existsSync(file)) {
    console.log(`  ⏭  ${file} not found — skipping`);
    return;
  }
  console.log(`\n📥  Restoring ${file} …`);
  const client = await pool.connect();
  const gz = fs.createReadStream(file).pipe(createGunzip());
  const rl = readline.createInterface({ input: gz, crlfDelay: Infinity });

  let buf = '';
  let rows = 0;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('SET ')) continue;
    buf += ' ' + trimmed;
    if (trimmed.endsWith(';')) {
      try {
        await client.query(buf.trim());
        if (buf.includes('INSERT')) rows++;
      } catch (e: any) {
        // log but continue so one bad row doesn't abort the whole restore
        if (!e.message.includes('already exists') && !e.message.includes('does not exist')) {
          process.stdout.write(`  ⚠️  ${e.message.slice(0, 120)}\n`);
        }
      }
      buf = '';
    }
  }
  client.release();
  console.log(`  ✅ Restored ${rows.toLocaleString()} rows from ${file}`);
}

// ── Step 1: core schema from db-migration files ───────────────────────────────

async function runFileMigrations() {
  console.log('\n🔧  Running db-migration files …');
  const { runGoldenPricingMigration } = await import('../server/db-migrations/golden-pricing-migration');
  await runGoldenPricingMigration();

  const { runInstitutionalDataMigration } = await import('../server/db-migrations/institutional-data-migration');
  await runInstitutionalDataMigration();

  const { initializeSecurityMaster } = await import('../server/db-migrations/security-master-migration');
  await initializeSecurityMaster();
}

// ── Step 2: inline migrations from server/index.ts ───────────────────────────

async function runInlineMigrations() {
  console.log('\n🔧  Running inline CREATE TABLE / ALTER TABLE migrations …');

  await runSQL('agent_notifications', `
    CREATE TABLE IF NOT EXISTS agent_notifications (
      id         SERIAL PRIMARY KEY,
      agent_id   TEXT NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      type       TEXT NOT NULL DEFAULT 'info',
      link       TEXT,
      read_at    TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_agent_notifications_agent_id ON agent_notifications (agent_id);
  `);

  await runSQL('capital_gains_tax_reminders columns', `
    ALTER TABLE capital_gains_tax_reminders
      ADD COLUMN IF NOT EXISTS prospect_id VARCHAR,
      ADD COLUMN IF NOT EXISTS created_by_agent_id VARCHAR
  `);

  await runSQL('agents/partners arn_expiry_date', `
    ALTER TABLE agents  ADD COLUMN IF NOT EXISTS arn_expiry_date TIMESTAMPTZ;
    ALTER TABLE partners ADD COLUMN IF NOT EXISTS arn_expiry_date TIMESTAMPTZ
  `);

  await runSQL('prospect_id columns', `
    ALTER TABLE tax_reminder_subscriptions ADD COLUMN IF NOT EXISTS prospect_id VARCHAR;
    ALTER TABLE kyc_approvals              ADD COLUMN IF NOT EXISTS prospect_id VARCHAR;
    ALTER TABLE mf_orders                  ADD COLUMN IF NOT EXISTS prospect_id VARCHAR;
    ALTER TABLE prospect_proposals         ADD COLUMN IF NOT EXISTS prospect_id VARCHAR
  `);

  await runSQL('screener_stocks extra columns', `
    ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS is_active           BOOLEAN DEFAULT true;
    ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS current_price       NUMERIC(20,6);
    ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS market_cap_value    NUMERIC(20,2);
    ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS market_cap_category VARCHAR(20);
    ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS country             VARCHAR(10) DEFAULT 'IN';
    ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS currency            VARCHAR(10) DEFAULT 'INR';
    ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS data_source         VARCHAR(50);
    ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW()
  `);

  await runSQL('mutual_funds 30 extra columns', `
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS plan_type                  VARCHAR DEFAULT 'regular';
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS is_published               BOOLEAN DEFAULT false;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS published_at               TIMESTAMPTZ;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS published_by               VARCHAR;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS amfi_code                  VARCHAR;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS isin                       VARCHAR;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS option_type                VARCHAR;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS scheme_status              VARCHAR DEFAULT 'active';
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS last_verified_at           TIMESTAMPTZ;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS data_source                VARCHAR;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS isin_dividend_payout       VARCHAR;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS isin_dividend_reinvest     VARCHAR;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS isin_growth                VARCHAR;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS repurchase_price           NUMERIC(15,4);
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS sale_price                 NUMERIC(15,4);
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS launch_date                DATE;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS min_sip_amount             NUMERIC(15,2);
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS min_lumpsum_amount         NUMERIC(15,2);
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS amc_code                   VARCHAR;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS exit_load_percent          NUMERIC(8,4);
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS exit_load_days             INTEGER;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS scheme_sub_category        VARCHAR;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS benchmark_index            VARCHAR;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS benchmark_index_code       VARCHAR;
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS benchmark_confidence_score NUMERIC(3,2);
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS taxonomy_version           VARCHAR(20) DEFAULT 'SEBI_2017';
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS compliance_status          VARCHAR(30) DEFAULT 'PENDING';
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS naming_validation_status   VARCHAR(10) DEFAULT 'PENDING';
    ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS lifecycle_metadata         JSONB
  `);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀  FintekPro — New Neon DB Setup');
  console.log(`   Target: ${TARGET!.match(/@([^/]+)/)?.[1]}`);

  try {
    await runFileMigrations();
  } catch (e: any) {
    console.error('⚠️  File migrations error (continuing):', e.message);
  }

  await runInlineMigrations();

  // Restore backed-up data
  await restoreGzip('backup-2026-03-29T05-57.sql.gz');
  await restoreGzip('backup-user-data-20260329.sql.gz');

  console.log('\n✅  All done! Your new Neon DB is ready.');
  console.log('   Next: set PRODUCTION_DATABASE_URL in Railway to this URL, then deploy.\n');
  await pool.end();
}

main().catch(e => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});
