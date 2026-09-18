#!/usr/bin/env node
// scripts/add-ipo-detail-fields.mjs
// Run this once when PostgreSQL is available to add IPO structured data columns.
// Usage: node scripts/add-ipo-detail-fields.mjs

import pkg from 'pg';
const { Client } = pkg;

const DB_URL =
  process.env.PRODUCTION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:66ba0a6b1acf6d425a982cbf857b70672ed9889b55bb015d@localhost:5432/fintekpro';

const ALTER_STATEMENTS = [
  // ── pre_ipo_companies ───────────────────────────────────────────────────
  `ALTER TABLE pre_ipo_companies ADD COLUMN IF NOT EXISTS issue_type varchar`,
  `ALTER TABLE pre_ipo_companies ADD COLUMN IF NOT EXISTS fresh_issue_shares bigint`,
  `ALTER TABLE pre_ipo_companies ADD COLUMN IF NOT EXISTS fresh_issue_amount decimal(15,2)`,
  `ALTER TABLE pre_ipo_companies ADD COLUMN IF NOT EXISTS ofs_shares bigint`,
  `ALTER TABLE pre_ipo_companies ADD COLUMN IF NOT EXISTS ofs_amount decimal(15,2)`,
  `ALTER TABLE pre_ipo_companies ADD COLUMN IF NOT EXISTS total_shares_on_offer bigint`,
  `ALTER TABLE pre_ipo_companies ADD COLUMN IF NOT EXISTS issue_size_crores decimal(15,2)`,
  `ALTER TABLE pre_ipo_companies ADD COLUMN IF NOT EXISTS stake_being_diluted decimal(6,3)`,
  `ALTER TABLE pre_ipo_companies ADD COLUMN IF NOT EXISTS price_band_min decimal(10,2)`,
  `ALTER TABLE pre_ipo_companies ADD COLUMN IF NOT EXISTS price_band_max decimal(10,2)`,
  `ALTER TABLE pre_ipo_companies ADD COLUMN IF NOT EXISTS open_date date`,
  `ALTER TABLE pre_ipo_companies ADD COLUMN IF NOT EXISTS close_date date`,
  `ALTER TABLE pre_ipo_companies ADD COLUMN IF NOT EXISTS listing_date date`,
  `ALTER TABLE pre_ipo_companies ADD COLUMN IF NOT EXISTS sebi_observation_letter_date date`,
  `ALTER TABLE pre_ipo_companies ADD COLUMN IF NOT EXISTS price_band_announcement_date date`,
  `ALTER TABLE pre_ipo_companies ADD COLUMN IF NOT EXISTS registrar varchar`,
  // ── ipo_companies ───────────────────────────────────────────────────────
  `ALTER TABLE ipo_companies ADD COLUMN IF NOT EXISTS fresh_issue_shares bigint`,
  `ALTER TABLE ipo_companies ADD COLUMN IF NOT EXISTS fresh_issue_amount decimal(15,2)`,
  `ALTER TABLE ipo_companies ADD COLUMN IF NOT EXISTS ofs_shares bigint`,
  `ALTER TABLE ipo_companies ADD COLUMN IF NOT EXISTS ofs_amount decimal(15,2)`,
  `ALTER TABLE ipo_companies ADD COLUMN IF NOT EXISTS total_shares_on_offer bigint`,
  `ALTER TABLE ipo_companies ADD COLUMN IF NOT EXISTS stake_being_diluted decimal(6,3)`,
  `ALTER TABLE ipo_companies ADD COLUMN IF NOT EXISTS sebi_observation_letter_date date`,
  `ALTER TABLE ipo_companies ADD COLUMN IF NOT EXISTS price_band_announcement_date date`,
  `ALTER TABLE ipo_companies ADD COLUMN IF NOT EXISTS listing_venue varchar`,
  `ALTER TABLE ipo_companies ADD COLUMN IF NOT EXISTS registrar varchar`,
];

const client = new Client({ connectionString: DB_URL, connectionTimeoutMillis: 10000 });

try {
  await client.connect();
  const { rows } = await client.query('SELECT current_database()');
  console.log(`Connected to: ${rows[0].current_database}`);

  let added = 0, skipped = 0, failed = 0;
  for (const sql of ALTER_STATEMENTS) {
    try {
      await client.query(sql);
      const col = sql.match(/ADD COLUMN IF NOT EXISTS (\S+)/)?.[1] ?? '?';
      const tbl = sql.match(/ALTER TABLE (\S+)/)?.[1] ?? '?';
      console.log(`  OK: ${tbl}.${col}`);
      added++;
    } catch (e) {
      if (e.message.includes('already exists')) { skipped++; }
      else { console.error(`  FAIL: ${e.message}`); failed++; }
    }
  }
  console.log(`\nDone: ${added} added, ${skipped} already existed, ${failed} failed`);
  await client.end();
  process.exit(failed > 0 ? 1 : 0);
} catch (e) {
  console.error('DB connection failed:', e.message);
  process.exit(1);
}
